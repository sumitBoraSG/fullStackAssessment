import { EntityRepository, Repository } from "typeorm";

import { UserInvitation } from "@database/model/UserInvitation";

@EntityRepository(UserInvitation)
export class UserInvitationRepo extends Repository<UserInvitation> {}