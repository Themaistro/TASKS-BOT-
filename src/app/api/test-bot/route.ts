import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { WebClient } from '@slack/web-api';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const dayParam = searchParams.get('day');

  const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
  const channelId = process.env.SLACK_CHANNEL_ID;

  if (!channelId || !process.env.SLACK_BOT_TOKEN) {
    return NextResponse.json({ error: 'Missing Slack credentials' }, { status: 500 });
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

    const activeCategories = categories.filter(c => c.assignments.length > 0);
    if (activeCategories.length === 0) return NextResponse.json({ error: 'No tasks for today to post!' }, { status: 400 });

    const fullDate = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dubai', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);

    const config = await prisma.config.findUnique({ where: { id: 'global' } });

    // 4. Construct message
    const headerText = config?.slackMessageHeader || `📋 *Today's Task Assignments*`;

    // 1. Post Header
    await slack.chat.postMessage({
      channel: channelId,
      text: `🗓️ Roster for ${fullDate}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🗓️ Roster for ${fullDate}`,
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: headerText
          }
        }
      ]
    });

    // 2. Post Each Category
    const employeeTasks: Record<string, { name: string, tasks: any[], breakSchedules?: any[] }> = {};

    for (const cat of activeCategories) {
      const emoji = cat.icon || '📌';
      
      for (const a of cat.assignments) {
        const slackId = a.employee.slackId;
        if (!employeeTasks[slackId]) employeeTasks[slackId] = { name: a.employee.name, breakSchedules: a.employee.breakSchedules || [], tasks: [] };
        employeeTasks[slackId].tasks.push({ catName: cat.name, emoji, note: a.note });
      }

      const lines = cat.assignments.map((a: any) => {
        const noteStr = a.note ? `   *${a.note}*` : '';
        return `• <@${a.employee.slackId}>${noteStr}`;
      }).join('\n');

      await slack.chat.postMessage({
        channel: channelId,
        text: `${emoji} ${cat.name}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${emoji} ${cat.name}*\n${lines}`
            }
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Acknowledge ✅",
                  emoji: true
                },
                value: `ack_${cat.id}`,
                action_id: "ack_btn"
              }
            ]
          }
        ]
      });
      await new Promise(r => setTimeout(r, 200));
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
      await slack.chat.postMessage({
        channel: channelId,
        text: "☕ Today's Break Schedule",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*☕ Break Schedule*\n${breakLines.join('\n')}`
            }
          }
        ]
      });
      await new Promise(r => setTimeout(r, 200));
    }

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
                text: `Good morning ${name.split(' ')[0]}! ☕\nHere are your assigned tasks for today:\n\n${taskLines}${breakLine}`
              }
            }
          ]
        });
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {}
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
