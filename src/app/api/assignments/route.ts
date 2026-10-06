export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const day = searchParams.get('day');
  
  const assignments = await prisma.assignment.findMany({
    where: day !== null ? { dayOfWeek: parseInt(day) } : undefined,
    include: { employee: { include: { breakSchedules: true } } }
  });
  return NextResponse.json(assignments);
}

export async function POST(request: Request) {
  const { dayOfWeek, categoryId, employeeId, note } = await request.json();
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { onLeaveDays: true } });
  try {
    if (JSON.parse(employee?.onLeaveDays || '[]').includes(dayOfWeek)) {
      return NextResponse.json({ error: 'This employee is marked off for the selected day.' }, { status: 400 });
    }
  } catch { /* malformed legacy leave data should not block assignments */ }
  const assignment = await prisma.assignment.create({
    data: { dayOfWeek, categoryId, employeeId, note },
    include: { employee: { include: { breakSchedules: true } } }
  });
  return NextResponse.json(assignment);
}
