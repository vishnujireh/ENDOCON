import { db, type DbOrTrx } from '../../db/knex.js';
import { Errors } from '../../lib/errors.js';
import { now } from '../../lib/time.js';
import type { ProfileInput } from './profile.schemas.js';

export interface ProfileDto {
  email: string;
  title: string | null;
  fullName: string;
  age: number | null;
  gender: string | null;
  designation: string | null;
  organization: string | null;
  mciStateCode: string | null;
  mciRegNo: string | null;
  membershipType: string | null;
  membershipNo: string | null;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pinCode: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface ProfileRow {
  user_id: number;
  email: string;
  title: string | null;
  full_name: string;
  age: number | null;
  gender: string | null;
  designation: string | null;
  organization: string | null;
  mci_state_code: string | null;
  mci_reg_no: string | null;
  membership_type: string | null;
  membership_no: string | null;
  phone_country_code: string | null;
  phone_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pin_code: string | null;
  completed_at: Date | null;
  updated_at: Date | null;
}

export async function getProfileRow(conn: DbOrTrx, userId: number): Promise<ProfileRow | null> {
  const row = await conn('users as u')
    .leftJoin('user_profiles as p', 'p.user_id', 'u.id')
    .where('u.id', userId)
    .first('p.*', 'u.email', 'u.id as user_id');
  return (row as ProfileRow) ?? null;
}

export function toProfileDto(row: ProfileRow): ProfileDto {
  return {
    email: row.email,
    title: row.title,
    fullName: row.full_name ?? '',
    age: row.age,
    gender: row.gender,
    designation: row.designation,
    organization: row.organization,
    mciStateCode: row.mci_state_code,
    mciRegNo: row.mci_reg_no,
    membershipType: row.membership_type,
    membershipNo: row.membership_no,
    phoneCountryCode: row.phone_country_code,
    phoneNumber: row.phone_number,
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    pinCode: row.pin_code,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export function profileInputToColumns(input: ProfileInput) {
  return {
    title: input.title,
    full_name: input.fullName,
    age: input.age,
    gender: input.gender,
    designation: input.designation,
    organization: input.organization,
    mci_state_code: input.mciStateCode,
    mci_reg_no: input.mciRegNo,
    membership_type: input.membershipType,
    membership_no: input.membershipType === 'sgei_member' ? input.membershipNo : null,
    phone_country_code: input.phoneCountryCode,
    phone_number: input.phoneNumber,
    address: input.address,
    city: input.city,
    state: input.state,
    country: input.country,
    pin_code: input.pinCode,
  };
}

export async function getProfile(userId: number): Promise<ProfileDto> {
  const row = await getProfileRow(db, userId);
  if (!row) throw Errors.notFound('Account not found.');
  return toProfileDto(row);
}

/**
 * Save Step 1. Once a conference has been purchased, fields that affected eligibility/pricing
 * (membership) are locked to keep the purchase consistent; contact details stay editable.
 */
export async function saveProfile(userId: number, input: ProfileInput): Promise<ProfileDto> {
  await db.transaction(async (trx) => {
    const existing = await trx('user_profiles').where({ user_id: userId }).forUpdate().first();
    const hasConference = await trx('conference_registrations').where({ user_id: userId }).first('id');
    const cols = profileInputToColumns(input);

    if (hasConference && existing) {
      if (existing.membership_type && existing.membership_type !== cols.membership_type) {
        throw Errors.conflict(
          'Membership type cannot be changed after your conference registration is confirmed. Please contact the organising team.',
          'PROFILE_LOCKED_FIELD',
        );
      }
    }

    if (existing) {
      await trx('user_profiles')
        .where({ user_id: userId })
        .update({ ...cols, completed_at: existing.completed_at ?? now() });
    } else {
      await trx('user_profiles').insert({ user_id: userId, ...cols, completed_at: now() });
    }
  });
  return getProfile(userId);
}
