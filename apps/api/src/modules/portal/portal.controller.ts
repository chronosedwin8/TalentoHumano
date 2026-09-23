import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MODULES } from '@talento/shared';
import { z } from 'zod';
import { Audit, Ctx, RequireModule } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RequestContext } from '../../common/types/request-context';
import { WorkflowsService } from '../../core/workflows/workflows.service';
import { LeavesService } from '../leaves/leaves.service';
import { PeopleService } from '../people/people.service';
import { LeaveRequestStatus } from '@prisma/client';
import { enumQuery } from '../../common/utils/crud';

const selfUpdateSchema = z.object({
  phone: z.string().max(40).nullable().optional(),
  mobile: z.string().max(40).nullable().optional(),
  personalEmail: z.string().email().max(180).nullable().optional(),
  address: z.string().max(240).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  hideCelebrations: z.boolean().optional(),
  directoryVisible: z.boolean().optional(),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  secondLastName: z.string().max(80).optional(),
  documentType: z.string().max(20).optional(),
  documentNumber: z.string().max(40).optional(),
  birthDate: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'undisclosed']).optional(),
  nationality: z.string().max(60).optional(),
});

/**
 * Employee self-service portal: one aggregated payload for the home screen
 * plus the endpoints the collaborator uses about their own data.
 */
@ApiTags('portal del colaborador')
@Controller({ path: 'portal', version: '1' })
@RequireModule(MODULES.DASHBOARD)
export class PortalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    private readonly leaves: LeavesService,
    private readonly workflows: WorkflowsService,
  ) {}

  @Get('home')
  @ApiOperation({ summary: 'Inicio del portal: tareas, solicitudes, feed y celebraciones' })
  async home(@Ctx() ctx: RequestContext) {
    const employeeId = ctx.employeeId;
    const companyId = ctx.companyId;
    const today = new Date();
    const localDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const [
      attendanceToday,
      pendingTasks,
      pendingCourses,
      pendingReviews,
      pendingSurveys,
      pendingPolicies,
      myRequests,
      approvals,
      recentPosts,
      recognitions,
    ] = await Promise.all([
      employeeId
        ? this.prisma.attendanceDay.findFirst({
            where: { companyId, employeeId, date: localDate },
          })
        : null,
      employeeId
        ? this.prisma.onboardingTask.count({
            where: {
              companyId,
              assigneeEmployeeId: employeeId,
              status: { in: ['pending', 'in_progress', 'overdue'] },
            },
          })
        : 0,
      employeeId
        ? this.prisma.enrollment.count({
            where: { companyId, employeeId, status: { in: ['assigned', 'in_progress'] } },
          })
        : 0,
      employeeId
        ? this.prisma.reviewAssignment.count({
            where: {
              companyId,
              reviewerEmployeeId: employeeId,
              status: { in: ['pending', 'in_progress'] },
              cycle: { status: { in: ['self_assessment', 'evaluation'] } },
            },
          })
        : 0,
      employeeId
        ? this.prisma.surveyInvitation.count({
            where: { companyId, employeeId, respondedAt: null, survey: { status: 'open' } },
          })
        : 0,
      employeeId
        ? this.prisma.policyAcknowledgement.count({
            where: { companyId, employeeId, acknowledgedAt: null },
          })
        : 0,
      employeeId
        ? this.prisma.leaveRequest.findMany({
            where: {
              companyId,
              employeeId,
              status: { in: ['pending', 'approved'] },
              deletedAt: null,
            },
            include: { leaveType: { select: { name: true, color: true } } },
            orderBy: { startDate: 'desc' },
            take: 5,
          })
        : [],
      this.workflows.pendingCount(ctx),
      this.prisma.post.findMany({
        where: { companyId, status: 'published', deletedAt: null },
        select: {
          id: true,
          title: true,
          excerpt: true,
          kind: true,
          isPinned: true,
          requiresAck: true,
          publishedAt: true,
        },
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
        take: 5,
      }),
      employeeId
        ? this.prisma.recognition.findMany({
            where: { companyId, toEmployeeId: employeeId, deletedAt: null },
            include: { from: { select: { fullName: true } }, value: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 3,
          })
        : [],
    ]);

    const balance = employeeId ? await this.leaves.balanceFor(companyId, employeeId) : null;

    return {
      attendanceToday,
      balance,
      pending: {
        tasks: pendingTasks,
        courses: pendingCourses,
        reviews: pendingReviews,
        surveys: pendingSurveys,
        policies: pendingPolicies,
        approvals,
      },
      myRequests,
      feed: recentPosts,
      recognitions,
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Ficha del colaborador autenticado' })
  async me(@Ctx() ctx: RequestContext) {
    if (!ctx.employeeId) return null;
    return this.people.findOne(ctx, ctx.employeeId);
  }

  @Patch('me')
  @Audit({ entityType: 'employee', summary: 'Autoservicio de datos personales' })
  @ApiOperation({
    summary: 'Actualiza datos propios; los datos sensibles pasan por aprobacion de HR',
  })
  async updateMe(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(selfUpdateSchema)) dto: Record<string, unknown>,
  ) {
    return this.people.selfUpdate(ctx, dto);
  }

  @Get('my-documents')
  @ApiOperation({ summary: 'Documentos visibles del legajo propio' })
  async myDocuments(@Ctx() ctx: RequestContext) {
    if (!ctx.employeeId) return [];
    return this.prisma.employeeDocument.findMany({
      where: {
        companyId: ctx.companyId,
        employeeId: ctx.employeeId,
        deletedAt: null,
        documentType: { visibleToEmployee: true },
      },
      include: { documentType: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('my-assets')
  @ApiOperation({ summary: 'Activos asignados al colaborador' })
  async myAssets(@Ctx() ctx: RequestContext) {
    if (!ctx.employeeId) return [];
    return this.prisma.assetAssignment.findMany({
      where: { companyId: ctx.companyId, employeeId: ctx.employeeId, returnedAt: null },
      include: { asset: true },
    });
  }

  @Get('my-certificates')
  @ApiOperation({ summary: 'Certificados de formacion del colaborador' })
  async myCertificates(@Ctx() ctx: RequestContext) {
    if (!ctx.employeeId) return [];
    return this.prisma.certificate.findMany({
      where: { companyId: ctx.companyId, employeeId: ctx.employeeId },
      include: { course: { select: { title: true } } },
      orderBy: { issuedAt: 'desc' },
    });
  }

  @Get('my-requests')
  @ApiOperation({ summary: 'Todas las solicitudes del colaborador' })
  async myRequests(@Ctx() ctx: RequestContext, @Query('status') status?: string) {
    if (!ctx.employeeId) return { leaves: [], tickets: [], changeRequests: [] };
    const [leaves, tickets, changeRequests] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: {
          companyId: ctx.companyId,
          employeeId: ctx.employeeId,
          deletedAt: null,
          ...(status ? { status: enumQuery(status, LeaveRequestStatus, 'status') } : {}),
        },
        include: { leaveType: { select: { name: true, color: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.ticket.findMany({
        where: { companyId: ctx.companyId, requesterUserId: ctx.userId, deletedAt: null },
        include: { category: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.employeeChangeRequest.findMany({
        where: { companyId: ctx.companyId, employeeId: ctx.employeeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { leaves, tickets, changeRequests };
  }

  @Get('my-team')
  @ApiOperation({ summary: 'Equipo a cargo con sus pendientes' })
  async myTeam(@Ctx() ctx: RequestContext) {
    if (!ctx.employeeId) return { members: [] };
    const members = await this.prisma.employee.findMany({
      where: { companyId: ctx.companyId, managerId: ctx.employeeId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        status: true,
        email: true,
        position: { select: { name: true } },
      },
      orderBy: { fullName: 'asc' },
    });
    const ids = members.map((member) => member.id);
    if (!ids.length) return { members: [] };

    const [absences, onboarding] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: {
          companyId: ctx.companyId,
          employeeId: { in: ids },
          status: { in: ['pending', 'approved'] },
          endDate: { gte: new Date() },
          deletedAt: null,
        },
        include: { leaveType: { select: { name: true, color: true } } },
      }),
      this.prisma.onboardingProcess.findMany({
        where: {
          companyId: ctx.companyId,
          employeeId: { in: ids },
          status: { in: ['pending', 'in_progress', 'overdue'] },
        },
        select: { id: true, employeeId: true, kind: true, progress: true, status: true },
      }),
    ]);

    return { members, absences, onboarding };
  }
}
