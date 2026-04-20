export type SdqCategory =
  | 'emotional'
  | 'conduct'
  | 'hyperactivity'
  | 'peer'
  | 'prosocial';

export interface SdqQuestion {
  id: number;
  text: string;
  category: SdqCategory;
  reverse: boolean;
}

export const SDQ_QUESTIONS: SdqQuestion[] = [
  { id: 1, text: 'ห่วงใย ใส่ใจความรู้สึกของคนอื่น', category: 'prosocial', reverse: false },
  { id: 2, text: 'อยู่ไม่นิ่ง ไม่สามารถอยู่นิ่งได้นาน', category: 'hyperactivity', reverse: false },
  { id: 3, text: 'มักจะบ่นว่าปวดศีรษะ ปวดท้อง หรือไม่สบาย', category: 'emotional', reverse: false },
  { id: 4, text: 'เต็มใจแบ่งปันสิ่งของให้เพื่อน', category: 'prosocial', reverse: false },
  { id: 5, text: 'มักจะอาละวาดหรือโมโหร้าย', category: 'conduct', reverse: false },
  { id: 6, text: 'ค่อนข้างแยกตัว ชอบเล่นคนเดียว', category: 'peer', reverse: false },
  { id: 7, text: 'เชื่อฟัง มักจะทำตามที่ผู้ใหญ่ต้องการ', category: 'conduct', reverse: true },
  { id: 8, text: 'กังวลใจหลายเรื่อง ดูวิตกกังวลเสมอ', category: 'emotional', reverse: false },
  { id: 9, text: 'เป็นที่พึ่งได้เวลาที่คนอื่นเสียใจ', category: 'prosocial', reverse: false },
  { id: 10, text: 'อยู่ไม่สุข วุ่นวายอย่างมาก', category: 'hyperactivity', reverse: false },
  { id: 11, text: 'มีเพื่อนสนิทอย่างน้อยหนึ่งคน', category: 'peer', reverse: true },
  { id: 12, text: 'มักมีเรื่องทะเลาะวิวาทกับเด็กอื่น', category: 'conduct', reverse: false },
  { id: 13, text: 'ดูไม่มีความสุข ท้อแท้ ร้องไห้บ่อย', category: 'emotional', reverse: false },
  { id: 14, text: 'เป็นที่ชื่นชอบของเพื่อน', category: 'peer', reverse: true },
  { id: 15, text: 'วอกแวกง่าย สมาธิสั้น', category: 'hyperactivity', reverse: false },
  { id: 16, text: 'เครียด ไม่ยอมห่างเวลาอยู่ในสถานการณ์ที่ไม่คุ้น', category: 'emotional', reverse: false },
  { id: 17, text: 'ใจดีกับเด็กที่เล็กกว่า', category: 'prosocial', reverse: false },
  { id: 18, text: 'ชอบโกหกหรือขี้โกง', category: 'conduct', reverse: false },
  { id: 19, text: 'ถูกเด็กคนอื่นล้อเลียนหรือรังแก', category: 'peer', reverse: false },
  { id: 20, text: 'ชอบอาสาช่วยเหลือคนอื่น', category: 'prosocial', reverse: false },
  { id: 21, text: 'คิดก่อนทำ', category: 'hyperactivity', reverse: true },
  { id: 22, text: 'ขโมยของที่บ้าน ที่โรงเรียน หรือที่อื่น', category: 'conduct', reverse: false },
  { id: 23, text: 'เข้ากับผู้ใหญ่ได้ดีกว่าเด็กวัยเดียวกัน', category: 'peer', reverse: false },
  { id: 24, text: 'ขี้กลัว รู้สึกหวาดกลัวได้ง่าย', category: 'emotional', reverse: false },
  { id: 25, text: 'ทำงานได้จนเสร็จ มีความตั้งใจในการทำงาน', category: 'hyperactivity', reverse: true },
];
