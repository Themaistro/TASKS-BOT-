import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Delete associated tasks first due to relations (or rely on Cascade, but SQLite might be strict)
    await prisma.assignment.deleteMany({
      where: { employeeId: id }
    });
    
    await prisma.employee.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const employee = await prisma.employee.update({
      where: { id },
      data: { 
        ...(body.onLeaveDays !== undefined && { onLeaveDays: body.onLeaveDays }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.slackId !== undefined && { slackId: body.slackId }),
      },
      include: { breakSchedules: true },
    });
    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}
