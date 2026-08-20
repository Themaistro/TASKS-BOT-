import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const employees = await prisma.employee.findMany({
    include: { breakSchedules: true }
  });
  return NextResponse.json(employees);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, slackId } = body;
  
  if (!name || !slackId) {
    return NextResponse.json({ error: 'Name and Slack ID are required' }, { status: 400 });
  }

  try {
    const employee = await prisma.employee.create({
      data: { name, slackId },
      include: { breakSchedules: true },
    });
    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create employee (Slack ID might already exist)' }, { status: 500 });
  }
}
