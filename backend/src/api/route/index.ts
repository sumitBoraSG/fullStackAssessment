import { Application, Request, Response } from "express";
import AuthRoute from "@api/route/auth.routes";
import adminRoutes from "./admin.routes";
import { doctorRoutes, doctorsDiscoveryRoutes } from "./doctor.routes";
import appointmentRoute from "./appointment.route";
import patientRoutes from "./patient.routes";
export class Routes {
  public routes(app: Application): void {
    app.use("/auth", AuthRoute);
    app.use("/admin", adminRoutes);
    app.use("/doctor", doctorRoutes);
    app.use("/doctors", doctorsDiscoveryRoutes);
    app.use("/appointments", appointmentRoute);
    app.use("/patient", patientRoutes);
    app.get("/", (req: Request, res: Response) => {
      res.status(200).json({ success: true, data: { status: "ok" } });
    });
  }
}

