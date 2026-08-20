const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { WebClient } = require('@slack/web-api');
const { SocketModeClient } = require('@slack/socket-mode');

// Load environment variables directly so they are available immediately
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();

app.prepare().then(() => {
  // Start Slack Socket Mode if Token exists
  const appToken = process.env.SLACK_APP_TOKEN;
  if (appToken) {
    const socketClient = new SocketModeClient({ appToken });
    const slackWeb = new WebClient(process.env.SLACK_BOT_TOKEN);

    socketClient.on('interactive', async ({ body, ack }) => {
      await ack(); // Tell Slack we received the interaction
      
      if (body.type === 'block_actions' && body.actions?.[0]?.action_id === 'ack_btn') {
        const userId = body.user.id;
        const originalBlocks = body.message.blocks;
        
        let ackBlock = originalBlocks.find(b => b.block_id === 'ack_block');
        if (!ackBlock) {
          ackBlock = {
            type: 'context',
            block_id: 'ack_block',
            elements: [{ type: 'mrkdwn', text: `*✅ Acknowledged by:* <@${userId}>` }]
          };
          const actionsIdx = originalBlocks.findIndex((b) => b.type === 'actions');
          if (actionsIdx > -1) {
            originalBlocks.splice(actionsIdx, 0, ackBlock);
          } else {
            originalBlocks.push(ackBlock);
          }
        } else {
          const text = ackBlock.elements[0].text;
          if (!text.includes(`<@${userId}>`)) {
            ackBlock.elements[0].text = `${text}, <@${userId}>`;
          }
        }

        try {
          await slackWeb.chat.update({
            channel: body.channel.id,
            ts: body.message.ts,
            blocks: originalBlocks,
            text: body.message.text
          });
        } catch (e) {
          console.error("Failed to update slack message:", e);
        }
      }
    });

    socketClient.start().then(() => {
      console.log('> ⚡️ Slack Socket Mode is active. Listening for button clicks...');
    }).catch(console.error);
  }

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
    
    if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
      console.warn('⚠️  SLACK_BOT_TOKEN or SLACK_CHANNEL_ID missing! Bot will not post to Slack.');
    }

    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

    // Start Cron Job
    cron.schedule('* * * * *', async () => {
      try {
        const config = await prisma.config.findUnique({ where: { id: 'global' } });
        if (!config || !config.isAutomationActive) return;

        const tz = config.timezone || 'Asia/Dubai';
        const now = new Date();
        const options = { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false };
        const currentTimeStr = new Intl.DateTimeFormat('en-US', options).format(now); 
        // Note: getDay() gives the day in local system time, which might be off. 
        // We really should use the target timezone's day.
        const currentDayStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
        const daysMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
        const currentDay = daysMap[currentDayStr];
        
        if (config.postTime !== currentTimeStr) return;

        // Fetch categories with assignments for today
        const categories = await prisma.category.findMany({
          orderBy: { order: 'asc' },
          include: {
            assignments: {
              where: { dayOfWeek: currentDay },
              include: { employee: { include: { breakSchedules: true } } }
            }
          }
        });

        // Filter out categories with no assignments today
        const activeCategories = categories.filter(c => c.assignments.length > 0);
        if (activeCategories.length === 0) return; // Nothing to post today

        console.log(`[${currentTimeStr} ${tz}] Triggering Daily Roster Post!`);

        const fullDateStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
        
        const targetChannel = config.slackChannel || process.env.SLACK_CHANNEL_ID;

        if (targetChannel && process.env.SLACK_BOT_TOKEN) {
          // 1. Post Header
          const headerText = config.slackMessageHeader || `📋 *Today's Task Assignments*`;
          await slack.chat.postMessage({
            channel: targetChannel,
            text: `🗓️ Daily Roster for ${fullDateStr}`,
            blocks: [
              {
                type: "header",
                text: {
                  type: "plain_text",
                  text: `🗓️ Daily Roster for ${fullDateStr}`,
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

          // 2. Post Each Category Separately
          const employeeTasks = {};

          for (const cat of activeCategories) {
            const emoji = cat.icon || '📌';
            
            // Group for DMs
            for (const a of cat.assignments) {
              const slackId = a.employee.slackId;
              if (!employeeTasks[slackId]) employeeTasks[slackId] = { name: a.employee.name, breakSchedules: a.employee.breakSchedules || [], tasks: [] };
              employeeTasks[slackId].tasks.push({ catName: cat.name, emoji, note: a.note });
            }

            const assignments = cat.assignments.map(a => {
              const noteStr = a.note ? `   *${a.note}*` : '';
              return `• <@${a.employee.slackId}>${noteStr}`;
            }).join('\n');

            await slack.chat.postMessage({
              channel: targetChannel,
              text: `${emoji} ${cat.name}`,
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `*${emoji} ${cat.name}*\n${assignments}`
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
            // Small delay to guarantee Slack ordering
            await new Promise(r => setTimeout(r, 200));
          }

          // 2.5 Post Consolidated Break Schedule
          const breakLines = [];
          const fmtTimeGlobal = (t) => { const [h,m] = t.split(':').map(Number); return `${h%12||12}:${m.toString().padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
          
          for (const slackId of Object.keys(employeeTasks)) {
            const emp = employeeTasks[slackId];
            const todayBreak = (emp.breakSchedules || []).find(b => b.dayOfWeek === currentDay);
            if (todayBreak) {
              breakLines.push(`• <@${slackId}>: ${fmtTimeGlobal(todayBreak.startTime)} – ${fmtTimeGlobal(todayBreak.endTime)}`);
            }
          }

          if (breakLines.length > 0) {
            await slack.chat.postMessage({
              channel: targetChannel,
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

          // 3. Send Individual DMs to Employees
          for (const slackId of Object.keys(employeeTasks)) {
            const { name, tasks, breakSchedules: empSchedules } = employeeTasks[slackId];
            const taskLines = tasks.map((t) => `${t.emoji} *${t.catName}*${t.note ? `\n> _${t.note}_` : ''}`).join('\n\n');
            const todayBreak = (empSchedules || []).find(b => b.dayOfWeek === currentDay);
            const fmtTime = (t) => { const [h,m] = t.split(':').map(Number); return `${h%12||12}:${m.toString().padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
            const breakLine = todayBreak ? `\n\n☕ *Break:* ${fmtTime(todayBreak.startTime)} – ${fmtTime(todayBreak.endTime)}` : '';
            
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
              // Small delay to prevent hitting Slack rate limits on DMs
              await new Promise(r => setTimeout(r, 200));
            } catch (e) {
              console.error(`Failed to send DM to ${slackId}:`, e);
            }
          }

          console.log(`[${currentTimeStr} ${tz}] Successfully posted roster and sent DMs!`);
        }
      } catch (error) {
        console.error("Error in cron job:", error);
      }
    });
    console.log('> Cron scheduler started (respects DB timezone and active status)');
  });
});
