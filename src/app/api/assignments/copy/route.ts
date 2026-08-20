import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { fromDay, toDay } = await request.json();

    if (fromDay === undefined || toDay === undefined) {
      return NextResponse.json({ error: 'fromDay and toDay are required' }, { status: 400 });
    }

    // Get existing assignments from the source day
    const existing = await prisma.assignment.findMany({
      where: { dayOfWeek: fromDay }
    });

    if (existing.length === 0) {
      return NextResponse.json({ message: 'Nothing to copy' });
    }

    // Optionally clear existing assignments on the target day to prevent massive duplicates?
    // User might want to merge, but "Copy from yesterday" implies an override.
    await prisma.assignment.deleteMany({
      where: { dayOfWeek: toDay }
    });

    // Create the clones
    await prisma.assignment.createMany({
      data: existing.map(a => ({
        categoryId: a.categoryId,
        employeeId: a.employeeId,
        note: a.note,
        dayOfWeek: toDay
      }))
    });

    return NextResponse.json({ success: true, count: existing.length });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to copy roster' }, { status: 500 });
  }
}
