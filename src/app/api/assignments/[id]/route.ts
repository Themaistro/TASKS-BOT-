import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.assignment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const data: any = {};
    if (body.categoryId !== undefined) data.categoryId = body.categoryId;
    if (body.note !== undefined) data.note = body.note;

    const assignment = await prisma.assignment.update({
      where: { id },
      data,
    });
    
    return NextResponse.json(assignment);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}
