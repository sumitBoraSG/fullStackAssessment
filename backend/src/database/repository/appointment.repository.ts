import { EntityRepository, Repository } from "typeorm";
import { Appointment } from "@database/model/Appointment";

@EntityRepository(Appointment)
export class AppointmentRepository extends Repository<Appointment> {}