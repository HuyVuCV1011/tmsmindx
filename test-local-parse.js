const value = 'Họ và tên';
const value2 = 'Số điện thoại';

const normalizeText = (value) => {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

console.log('n1:', normalizeText(value));
console.log('n2:', normalizeText(value2));

const normalizedHeaders = [
  'ma ung vien official', 'thoi gian', 'ma ung vien', 'gen', 'ho va ten', 'co so mong muon lam viec', 
  'khoi ban chon de lam viec', 'nam sinh', 'e mail', 'so dien thoai'
]

const aliasesName = ['ho va ten', 'ho ten', 'ten ung vien', 'ten uv', 'ten', 'full name', 'candidate name', 'name'];
const aliasesPhone = ['so dien thoai', 'dien thoai', 'sdt', 'phone', 'mobile'];

function pickColumnIndex(normalizedHeaders, aliases) {
  return normalizedHeaders.findIndex((header) => aliases.some((alias) => header === alias || header.includes(alias)));
}

console.log('nameIndex:', pickColumnIndex(normalizedHeaders, aliasesName));
console.log('phoneIndex:', pickColumnIndex(normalizedHeaders, aliasesPhone));