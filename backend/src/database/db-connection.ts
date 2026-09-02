import logger from "@core/logger";
import { createConnection, Connection, ConnectionOptions } from "typeorm";
import { SnakeNamingStrategy } from "typeorm-naming-strategies";
import { DATABASE_URL, TYPEORM_LOGGING } from "@config/secret";
import path from "path";

import { User } from "./model/User";
import { Doctor } from "./model/Doctor";
import { Patient } from "./model/Patient";
import { Specialization } from "./model/Specialization";
import { DoctorAvailability } from "./model/DoctorAvailability";
import { Appointment } from "./model/Appointment";
import { UserInvitation } from "./model/UserInvitation";

export class DBConnection {
  public static conn: Connection;

  public static async databaseConnection(): Promise<void> {
    const dbConfig: ConnectionOptions = {
      type: "postgres",
      url: DATABASE_URL,

      entities: [
        User,
        Doctor,
        Patient,
        Specialization,
        DoctorAvailability,
        Appointment,
        UserInvitation,
      ],
      migrations: [path.join(__dirname, "migration", "*.{js,ts}")],

      synchronize: false,
      logging: Boolean(TYPEORM_LOGGING),
      namingStrategy: new SnakeNamingStrategy(),
    };

    try {
      this.conn = await createConnection(dbConfig);
      logger.info("Connected to DB");
    } catch (error) {
      logger.error("Not Connected to DB");
      logger.error(error);
      throw error;
    }
  }

  public static closeConnection(): Promise<void> {
    return this.conn.close();
  }
}
