import { EntityRepository, Repository } from "typeorm";
import { User } from "@database/model/User";

@EntityRepository(User)
export class UserRepo extends Repository<User> {}
