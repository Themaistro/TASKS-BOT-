export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const { name, order, icon } = await request.json();
  const category = await prisma.category.create({ data: { name, order, icon } });
  return NextResponse.json(category);
}

export async function PUT(req: Request) {
  try {
    const { id, name, order, icon, excludedDays } = await req.json();
    const cat = await prisma.category.update({
      where: { id },
      data: { name, order, icon, excludedDays }
    });
    return NextResponse.json(cat);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

