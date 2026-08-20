import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const schedules = await prisma.breakSchedule.findMany();
  return NextResponse.json(schedules);
}

export async function POST(request: Request) {
  const { employeeId, dayOfWeek, startTime, endTime } = await request.json();
  if (!employeeId || dayOfWeek === undefined || !startTime || !endTime) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  const schedule = await prisma.breakSchedule.upsert({
    where: { employeeId_dayOfWeek: { employeeId, dayOfWeek } },
    update: { startTime, endTime },
    create: { employeeId, dayOfWeek, startTime, endTime },
  });
  return NextResponse.json(schedule);
}
