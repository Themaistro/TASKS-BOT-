import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const [installation, employees, categories, config] = await Promise.all([
    prisma.slackInstallation.findUnique({ where: { id: 'global' }, select: { teamName: true } }),
    prisma.employee.count(),
    prisma.category.count(),
    prisma.config.findUnique({ where: { id: 'global' }, select: { slackChannel: true, isAutomationActive: true } }),
  ]);
  return NextResponse.json({
    slackConnected: Boolean(installation),
    workspace: installation?.teamName || null,
    hasEmployees: employees > 0,
    hasCategories: categories > 0,
    hasChannel: Boolean(config?.slackChannel),
    automationActive: Boolean(config?.isAutomationActive),
  });
}
