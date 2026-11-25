/**
 * «Давхар баталгаажуулалт»-ын жагсаалтын мөр бүр дээр аль дамжлагын, юуны бүртгэл
 * болохыг харуулах шошго. Цэвэр функц — React/DB-ээс хамааралгүй.
 */
import { masterStationFormConfig } from './master-stations';

export type StationCatalogEntry = { code: string; name: string };

export type ApprovalRecordLabelInput = {
  /** Мөрийн дамжлагын код, жишээ нь `ҮЯ-130`. */
  code: unknown;
  /** Dashboard-ийн станцын каталог — дамжлагын нэрийн үндсэн эх сурвалж. */
  stations?: readonly StationCatalogEntry[] | null;
  /** Каталогт байхгүй код дээр мөрийн өөрийнх нь нэр (жишээ нь сервэрийн `stationName`). */
  fallbackName?: unknown;
  /** Мастерын маягтын мөр бол дамжлагын нэрийн оронд маягтын бүртгэлийн нэрийг харуулна. */
  masterForm?: boolean;
};

export type ApprovalRecordLabel = {
  /** Дамжлагын код. Мэдэгдэхгүй бол ''. */
  code: string;
  /** Дамжлагын нэр: каталог, эс бол мөрийн өөрийн нэр. Мэдэгдэхгүй бол ''. */
  name: string;
  /** Мастерын маягтын бүртгэлийн нэр (`ҮЯ-310:` угтваргүй). Мастерын маягтын мөр биш бол ''. */
  recordTitle: string;
  /** Нүдэнд харуулах тайлбар: бүртгэлийн нэр байвал тэр, үгүй бол дамжлагын нэр. */
  description: string;
};

const text = (value: unknown) => String(value ?? '').trim();

/** Нэр нь кодтой ижил бол (нэр оноогдоогүй станц) «ҮЯ-130 / ҮЯ-130» гэж давтахгүй. */
function realName(name: unknown, code: string) {
  const value = text(name);
  return value && value !== code ? value : '';
}

function catalogName(code: string, stations: ApprovalRecordLabelInput['stations']) {
  if (!code) return '';
  for (const station of stations ?? []) {
    if (text(station?.code) !== code) continue;
    const name = realName(station?.name, code);
    if (name) return name;
  }
  return '';
}

/** `ҮЯ-310: Засварын мастерын …` → `Засварын мастерын …` (код нь тусдаа badge-д харагддаг). */
function masterRecordTitle(code: string) {
  const config = masterStationFormConfig(code);
  if (!config) return '';
  const title = text(config.title);
  const prefix = `${config.stationCode}:`;
  return title.startsWith(prefix) ? title.slice(prefix.length).trim() : title;
}

export function approvalRecordLabel({
  code,
  stations,
  fallbackName,
  masterForm = false,
}: ApprovalRecordLabelInput): ApprovalRecordLabel {
  const stationCode = text(code);
  const name = catalogName(stationCode, stations) || realName(fallbackName, stationCode);
  const recordTitle = masterForm ? masterRecordTitle(stationCode) : '';
  return { code: stationCode, name, recordTitle, description: recordTitle || name };
}
