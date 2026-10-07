import sanitizeHtml from "sanitize-html";
import { BadRequestError } from "routing-controllers";

import { prisma } from "./../../utils/db";

import type { FeedbackCreateDto } from "./dtos/feedback-create.dto";
import type { AccessTokenPayload } from "./../auth/auth.service";

export class FeedbackService {
  static findMany() {
    return prisma.feedback.findMany({
      take: 50,
      select: {
        id: true,
        title: true,
        body: true,
        author: { select: { id: true, username: true } },
        receiver: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  static async createOne(input: FeedbackCreateDto, tokenPayload: AccessTokenPayload) {
    const receiver = await prisma.user.findUnique({
      where: { id: input.receiverId },
      select: { id: true },
    });

    if (!receiver) {
      throw new BadRequestError("Receiver does not exist");
    }

    return prisma.feedback.create({
      data: {
        title: sanitizeHtml(input.title, { allowedTags: [] }),
        body: sanitizeHtml(input.body),
        receiverId: input.receiverId,
        authorId: tokenPayload.sub,
      },
      select: {
        id: true,
        title: true,
        body: true,
        author: { select: { id: true, username: true } },
        receiver: { select: { id: true, username: true } },
      },
    });
  }
}
