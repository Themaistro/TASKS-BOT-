const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { WebClient } = require('@slack/web-api');
const { SocketModeClient } = require('@slack/socket-mode');

require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();

app.prepare().then(() => {
  // Fire up the Slack Socket Mode connection if we have a token
  const appToken = process.env.SLACK_APP_TOKEN;
  if (appToken) {
    const socketClient = new SocketModeClient({ appToken });
    const slackWeb = new WebClient(process.env.SLACK_BOT_TOKEN);

    // Listen for users clicking buttons in Slack
    socketClient.on('interactive', async ({ body, ack }) => {
      await ack(); // Let Slack know we got the click
      
      if (body.type === 'block_actions' && body.actions?.[0]?.action_id === 'ack_btn') {
        const userId = body.user.id;
        const originalBlocks = body.message.blocks;
        const categoryId = String(body.actions[0].value || '').replace('ack_', '');
        const ackBlockId = `ack_${categoryId}`;
        const actionBlockId = `actions_${categoryId}`;
        
        let ackBlock = originalBlocks.find(b => b.block_id === ackBlockId);
        if (!ackBlock) {
          ackBlock = {
            type: 'context',
            block_id: ackBlockId,
            elements: [{ type: 'mrkdwn', text: `*✅ Acknowledged by:* <@${userId}>` }]
          };
          const actionsIdx = originalBlocks.findIndex((b) => b.block_id === actionBlockId);
          if (actionsIdx > -1) {
            originalBlocks.splice(actionsIdx, 0, ackBlock); // Slide it in right above the button
          } else {
            originalBlocks.push(ackBlock);
          }
        } else {
          // If the block is already there, just tag on the new user
          if (!ackBlock.elements[0].text.includes(`<@${userId}>`)) {
            ackBlock.elements[0].text += `, <@${userId}>`;
          }
        }

        try {
          await slackWeb.chat.update({
            channel: body.channel.id,
            ts: body.message.ts,
            text: body.message.text,
            blocks: originalBlocks
          });
        } catch (e) {
          console.error('Oops, ran into an issue updating the Slack message:', e);
        }
      }
    });

    socketClient.start().then(() => {
      console.log('⚡️ Slack Socket worker is live and listening!');
    }).catch(console.error);
  } else {
    console.warn('[WARNING] Skipping Slack Socket connection (SLACK_APP_TOKEN is missing).');
  }

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(process.env.PORT || 3000, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> Web server is up and running on port ${process.env.PORT || 3000}`);
    
    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
      console.warn('[WARNING] Heads up: SLACK_BOT_TOKEN or SLACK_CHANNEL_ID is missing. The bot won\'t be able to post messages.');
    }

    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

    // Kick off the background cron job to post the roster every minute (if it matches the scheduled time)
    cron.schedule('* * * * *', async () => {
      try {
        const config = await prisma.config.findUnique({ where: { id: 'global' } });
        if (!config || !config.isAutomationActive) return;

        const tz = config.timezone || 'Asia/Dubai';
        const now = new Date();
        const options = { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false };
        const currentTimeStr = new Intl.DateTimeFormat('en-US', options).format(now); 
        
        const currentDayStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
        const daysMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
        const currentDay = daysMap[currentDayStr];
        
        // Only run if the current minute matches the scheduled post time
        if (config.postTime !== currentTimeStr) return;

        // Grab all categories that actually have people assigned to them today
        const categories = await prisma.category.findMany({
          orderBy: { order: 'asc' },
          include: {
            assignments: {
              where: { dayOfWeek: currentDay },
              include: { employee: { include: { breakSchedules: true } } }
            }
          }
        });

        const isOffToday = (onLeaveDays) => {
          try { return JSON.parse(onLeaveDays || '[]').includes(currentDay); } catch { return false; }
        };
        const availableCategories = categories.map(category => ({
          ...category,
          assignments: category.assignments.filter(assignment => !isOffToday(assignment.employee.onLeaveDays)),
        }));
        const activeCategories = availableCategories.filter(c => c.assignments.length > 0);
        if (activeCategories.length === 0) return; // Nobody is scheduled today, skip it

        console.log(`[${currentTimeStr} ${tz}] Time to post the daily roster!`);
        const fullDateStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
        const targetChannel = config.slackChannel || process.env.SLACK_CHANNEL_ID;

        if (targetChannel && process.env.SLACK_BOT_TOKEN) {
          const headerText = config.slackMessageHeader || `:clipboard: *Today's Task Assignments*`;
          const channelBlocks = [
            { type: 'header', text: { type: 'plain_text', text: `📋 Team Task Roster · ${fullDateStr}`, emoji: true } },
            { type: 'section', text: { type: 'mrkdwn', text: headerText } },
            { type: 'divider' }
          ];
          const employeeTasks = {};
          
          // Loop through categories and drop a message for each one
          for (const cat of activeCategories) {
            const emoji = cat.icon || ':pushpin:';
            for (const a of cat.assignments) {
              const slackId = a.employee.slackId;
              if (!employeeTasks[slackId]) employeeTasks[slackId] = { name: a.employee.name, breakSchedules: a.employee.breakSchedules || [], tasks: [] };
              employeeTasks[slackId].tasks.push({ catName: cat.name, emoji, note: a.note });
            }

            const assignments = cat.assignments.map(a => {
              const noteStr = a.note ? ` — _${a.note}_` : '';
              return `• <@${a.employee.slackId}>${noteStr}`;
            }).join('\n');

            channelBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${emoji} ${cat.name}*\n${assignments}` } });
            channelBlocks.push({ type: 'actions', block_id: `actions_${cat.id}`, elements: [{ type: 'button', text: { type: 'plain_text', text: '✓ Acknowledge', emoji: true }, value: `ack_${cat.id}`, action_id: 'ack_btn' }] });
          }

          const breakLines = [];
          const fmtTimeGlobal = (t) => { const [h,m] = t.split(':').map(Number); return `${h%12||12}:${m.toString().padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
          
          for (const slackId of Object.keys(employeeTasks)) {
            const emp = employeeTasks[slackId];
            const todayBreak = (emp.breakSchedules || []).find(b => b.dayOfWeek === currentDay);
            if (todayBreak) {
              breakLines.push(`• <@${slackId}>: ${fmtTimeGlobal(todayBreak.startTime)} to ${fmtTimeGlobal(todayBreak.endTime)}`);
            }
          }

          if (breakLines.length > 0) {
            channelBlocks.push({ type: 'divider' });
            channelBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*☕ Break Schedule*\n${breakLines.join('\n')}` } });
          }

          channelBlocks.splice(2, 0, { type: 'context', elements: [{ type: 'mrkdwn', text: `👥 *${Object.keys(employeeTasks).length} team members*  •  🗂️ *${activeCategories.length} task categories*` }] });
          channelBlocks.push({ type: 'divider' });
          channelBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: 'Please review your assignments and select *Acknowledge* for each relevant task group.' } });
          channelBlocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `Posted automatically by Task Bot • ${fullDateStr}` }] });
          await slack.chat.postMessage({ channel: targetChannel, text: `Team task roster for ${fullDateStr}`, blocks: channelBlocks.slice(0, 50) });

          // Shoot over a private DM to everyone working today
          for (const slackId of Object.keys(employeeTasks)) {
            const { name, tasks, breakSchedules: empSchedules } = employeeTasks[slackId];
            const taskLines = tasks.map((t) => `${t.emoji} *${t.catName}*${t.note ? `\n> _${t.note}_` : ''}`).join('\n\n');
            const todayBreak = (empSchedules || []).find(b => b.dayOfWeek === currentDay);
            const fmtTime = (t) => { const [h,m] = t.split(':').map(Number); return `${h%12||12}:${m.toString().padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
            const breakLine = todayBreak ? `\n\n:coffee: *Break:* ${fmtTime(todayBreak.startTime)} to ${fmtTime(todayBreak.endTime)}` : '';
            
            try {
              await slack.chat.postMessage({
                channel: slackId,
                text: `:wave: Your tasks for today`,
                blocks: [{ type: "section", text: { type: "mrkdwn", text: `Good morning, *${name.split(' ')[0]}* 👋\n\nHere is your task schedule for *${fullDateStr}*:\n\n${taskLines}${breakLine}\n\nPlease review the team roster in <#${targetChannel}> and acknowledge your task group.` } }]
              });
              await new Promise(r => setTimeout(r, 200));
            } catch (e) {
              console.error(`Bummer, couldn't send the morning DM to ${slackId}:`, e);
            }
          }
          console.log(`[${currentTimeStr} ${tz}] Roster published and DMs sent perfectly!`);
        }
      } catch (error) {
        console.error("Yikes, something broke in the cron job:", error);
      }
    });
    console.log('> Cron scheduler is ticking (automatically handling DB timezones)');
  });
});
