export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  let config = await prisma.config.findUnique({ where: { id: 'global' } });
  if (!config) {
    config = await prisma.config.create({ data: { id: 'global', postTime: '08:00' } });
  }
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  const { postTime, isAutomationActive, timezone, slackChannel, slackMessageHeader, workingDays } = await request.json();
  const updateData: any = {};
  if (postTime !== undefined) updateData.postTime = postTime;
  if (isAutomationActive !== undefined) updateData.isAutomationActive = isAutomationActive;
  if (timezone !== undefined) updateData.timezone = timezone;
  if (slackChannel !== undefined) updateData.slackChannel = slackChannel;
  if (slackMessageHeader !== undefined) updateData.slackMessageHeader = slackMessageHeader;
  if (workingDays !== undefined) updateData.workingDays = workingDays;

  const config = await prisma.config.upsert({
    where: { id: 'global' },
    update: updateData,
    create: { id: 'global', ...updateData }
  });
  return NextResponse.json(config);
}

