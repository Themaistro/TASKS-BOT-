import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.resolve(process.cwd(), '.env');

function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

function serializeEnv(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}="${v}"`)
    .join('\n') + '\n';
}

export async function GET() {
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    const vars = parseEnv(content);
    // Mask tokens — return only last 6 chars so user can confirm which key is set
    const mask = (v: string) => v ? '••••••••' + v.slice(-6) : '';
    return NextResponse.json({
      SLACK_BOT_TOKEN: mask(vars.SLACK_BOT_TOKEN || ''),
      SLACK_APP_TOKEN: mask(vars.SLACK_APP_TOKEN || ''),
      SLACK_CHANNEL_ID: vars.SLACK_CHANNEL_ID || '',
      hasValues: {
        SLACK_BOT_TOKEN: !!vars.SLACK_BOT_TOKEN,
        SLACK_APP_TOKEN: !!vars.SLACK_APP_TOKEN,
        SLACK_CHANNEL_ID: !!vars.SLACK_CHANNEL_ID,
      }
    });
  } catch {
    return NextResponse.json({ error: 'Could not read config' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
    const vars = parseEnv(content);

    // Only update fields that were actually provided and not the masked placeholder
    if (body.SLACK_BOT_TOKEN && !body.SLACK_BOT_TOKEN.startsWith('••')) {
      vars.SLACK_BOT_TOKEN = body.SLACK_BOT_TOKEN.trim();
    }
    if (body.SLACK_APP_TOKEN && !body.SLACK_APP_TOKEN.startsWith('••')) {
      vars.SLACK_APP_TOKEN = body.SLACK_APP_TOKEN.trim();
    }
    if (body.SLACK_CHANNEL_ID !== undefined) {
      vars.SLACK_CHANNEL_ID = body.SLACK_CHANNEL_ID.trim();
    }

    // Keep DATABASE_URL untouched always
    fs.writeFileSync(ENV_PATH, serializeEnv(vars), 'utf-8');

    return NextResponse.json({ success: true, needsRestart: !!(body.SLACK_BOT_TOKEN || body.SLACK_APP_TOKEN) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
