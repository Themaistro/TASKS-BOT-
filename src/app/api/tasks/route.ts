import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const tasks = await prisma.task.findMany({
    include: { employee: true },
  });
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { title, description, employeeId, postTime, daysOfWeek } = body;
  
  if (!title || !employeeId || !postTime || !daysOfWeek) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const task = await prisma.task.create({
      data: {
        title,
        description,
        employeeId,
        postTime,
        daysOfWeek: JSON.stringify(daysOfWeek), // ensure it's a string
      },
    });
    return NextResponse.json(task);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create task', details: error.message }, { status: 500 });
  }
}
