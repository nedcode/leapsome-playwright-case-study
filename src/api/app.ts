import "reflect-metadata";

import "dotenv/config";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";

import { createExpressServer, type Action } from "routing-controllers";
import { AuthController } from "./modules/auth/auth.controller";
import { FeedbackController } from "./modules/feedback/feedback.controller";
import { authConfig } from "./config";

const app = createExpressServer({
  cors: true,
  controllers: [AuthController, FeedbackController],
  currentUserChecker: async (action: Action) => {
    const authorization = action.request.headers["authorization"] ?? "";
    const token = authorization.split(" ")[1];
    if (!token) {
      return;
    }

    try {
      const tokenPayload = jwt.verify(token, authConfig.accessTokenSecret);
      if (!tokenPayload || typeof tokenPayload === "string") {
        return;
      }

      return tokenPayload;
    } catch {
      return;
    }
  },
  validation: true,
  classTransformer: true,
  /*
  plainToClassTransformOptions: {
    strategy: "excludeAll",
  },
  */
});

// routing-controllers sends its error response and then still calls next(error). Express's final handler sees that
// the headers were already sent and destroys the socket, so the next request on the same keep-alive connection fails
// with ECONNRESET. Stop the error here once a response exists (see FINDINGS.md, F1).
app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
  if (response.headersSent) {
    return;
  }

  next(error);
});

export { app };
