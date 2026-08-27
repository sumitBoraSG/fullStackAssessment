import { EntityRepository, Repository } from "typeorm";

import { DoctorAvailability } from "@database/model/DoctorAvailability";

@EntityRepository(DoctorAvailability)
export class DoctorAvailabilityRepo extends Repository<DoctorAvailability> { }