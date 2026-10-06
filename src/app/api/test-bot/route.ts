import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSlackClient } from '@/lib/slack';
import fs from 'fs';
import path from 'path';

function localEnv(name: string) {
  try {
    const line = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8').split(/\r?\n/).find(row => row.trim().startsWith(`${name}=`));
    return line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '') || '';
  } catch { return ''; }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dayParam = searchParams.get('day');

    const slack = await getSlackClient();
    const config = await prisma.config.findUnique({ where: { id: 'global' } });
    const channelId = localEnv('SLACK_CHANNEL_ID') || process.env.SLACK_CHANNEL_ID || config?.slackChannel;

    if (!channelId || !slack) {
      return NextResponse.json({ error: 'Connect Slack and choose a target channel first.' }, { status: 400 });
    }

  const now = new Date();
  const dubaimoment = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Dubai"}));
  const dubaiDay = dayParam ? parseInt(dayParam) : dubaimoment.getDay();
  try {
    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: {
        assignments: {
          where: { dayOfWeek: dubaiDay },
          include: { employee: { include: { breakSchedules: true } } }
        }
      }
    });

    const isOffToday = (onLeaveDays: string) => {
      try { return JSON.parse(onLeaveDays || '[]').includes(dubaiDay); } catch { return false; }
    };
    const availableCategories = categories.map(category => ({
      ...category,
      assignments: category.assignments.filter(assignment => !isOffToday(assignment.employee.onLeaveDays)),
    }));
    const activeCategories = availableCategories.filter(c => c.assignments.length > 0);
    if (activeCategories.length === 0) return NextResponse.json({ error: 'No tasks for today to post!' }, { status: 400 });

    const fullDate = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dubai', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);

    // 4. Construct message
    const headerText = config?.slackMessageHeader || `📋 *Today's Task Assignments*`;

    const channelBlocks: any[] = [
      { type: 'header', text: { type: 'plain_text', text: `📋 Team Task Roster · ${fullDate}`, emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text: headerText } },
      { type: 'divider' },
    ];

    const employeeTasks: Record<string, { name: string, tasks: any[], breakSchedules?: any[] }> = {};

    for (const cat of activeCategories) {
      const emoji = cat.icon || '📌';
      
      for (const a of cat.assignments) {
        const slackId = a.employee.slackId;
        if (!employeeTasks[slackId]) employeeTasks[slackId] = { name: a.employee.name, breakSchedules: a.employee.breakSchedules || [], tasks: [] };
        employeeTasks[slackId].tasks.push({ catName: cat.name, emoji, note: a.note });
      }

      const lines = cat.assignments.map((a: any) => {
        const noteStr = a.note ? ` — _${a.note}_` : '';
        return `• <@${a.employee.slackId}>${noteStr}`;
      }).join('\n');

      channelBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${emoji} ${cat.name}*\n${lines}` } });
      channelBlocks.push({ type: 'actions', block_id: `actions_${cat.id}`, elements: [{ type: 'button', text: { type: 'plain_text', text: '✓ Acknowledge', emoji: true }, value: `ack_${cat.id}`, action_id: 'ack_btn' }] });
    }

    // 2.5 Post Consolidated Break Schedule
    const breakLines = [];
    const fmtTimeGlobal = (t: string) => { const [h,m] = t.split(':').map(Number); return `${h%12||12}:${m.toString().padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
    
    for (const slackId of Object.keys(employeeTasks)) {
      const emp = employeeTasks[slackId];
      const todayBreak = (emp.breakSchedules || []).find((b: any) => b.dayOfWeek === dubaiDay);
      if (todayBreak) {
        breakLines.push(`• <@${slackId}>: ${fmtTimeGlobal(todayBreak.startTime)} – ${fmtTimeGlobal(todayBreak.endTime)}`);
      }
    }

    if (breakLines.length > 0) {
      channelBlocks.push({ type: 'divider' });
      channelBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*☕ Break Schedule*\n${breakLines.join('\n')}` } });
    }

    channelBlocks.splice(2, 0, { type: 'context', elements: [{ type: 'mrkdwn', text: `👥 *${Object.keys(employeeTasks).length} team members*  •  🗂️ *${activeCategories.length} task categories*` }] });
    channelBlocks.push({ type: 'divider' });
    channelBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: 'Please review your assignments and select *Acknowledge* for each relevant task group.' } });
    channelBlocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `Posted automatically by Task Bot • ${fullDate}` }] });
    await slack.chat.postMessage({ channel: channelId, text: `Team task roster for ${fullDate}`, blocks: channelBlocks.slice(0, 50) });

    for (const slackId of Object.keys(employeeTasks)) {
      const { name, tasks, breakSchedules: empSchedules } = employeeTasks[slackId];
      const taskLines = tasks.map((t: any) => `${t.emoji} *${t.catName}*${t.note ? `\n> _${t.note}_` : ''}`).join('\n\n');
      const fmtTime2 = (t: string) => { const [h,m] = t.split(':').map(Number); return `${h%12||12}:${m.toString().padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
      const todayBreak = (empSchedules || []).find((b: any) => b.dayOfWeek === dubaiDay);
      const breakLine = todayBreak ? `\n\n☕ *Break:* ${fmtTime2(todayBreak.startTime)} – ${fmtTime2(todayBreak.endTime)}` : '';
      
      try {
        await slack.chat.postMessage({
          channel: slackId,
          text: `📅 Your tasks for today`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Good morning, *${name.split(' ')[0]}* 👋\n\nHere is your task schedule for *${fullDate}*:\n\n${taskLines}${breakLine}\n\nPlease review the team roster in <#${channelId}> and acknowledge your task group.`
              }
            }
          ]
        });
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {}
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.data?.error || error?.message || 'Slack rejected the request.' }, { status: 500 });
  }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to prepare the Slack request.' }, { status: 500 });
  }
}
