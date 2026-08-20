import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(req: Request) {
  try {
    const { orderedIds } = await req.json();
    
    // Update the order for all provided categories
    const updates = orderedIds.map((id: string, index: number) =>
      prisma.category.update({
        where: { id },
        data: { order: index },
      })
    );
    
    await prisma.$transaction(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reorder categories' }, { status: 500 });
  }
}
