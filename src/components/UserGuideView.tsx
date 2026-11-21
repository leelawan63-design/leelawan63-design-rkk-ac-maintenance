import React, { useState } from 'react';
import {
  MonitorSmartphone,
  ClipboardPlus,
  History,
  Building2,
  FileText,
  Sheet,
  BookOpen,
} from 'lucide-react';
import { useDeviceMode } from '../lib/deviceMode';
import type { UserAccount } from '../types';

type GuideSectionId =
  | 'all'
  | 'login_device'
  | 'daily_entry'
  | 'history'
  | 'inventory_tech'
  | 'reports'
  | 'sheets_admin';

interface GuideSection {
  id: Exclude<GuideSectionId, 'all'>;
  title: string;
  shortLabel: string;
  subtitle: string;
  icon: React.ReactNode;
  steps: Array<{ num: number; title: string; detail: string }>;
  tip: string;
  illustration: React.ReactNode;
}

const GUIDE_TABS: Array<{ id: GuideSectionId; label: string; adminOnly?: boolean }> = [
  { id: 'all', label: 'ดูทั้งหมด' },
  { id: 'login_device', label: '1. เข้าสู่ระบบและเลือกเครื่อง' },
  { id: 'daily_entry', label: '2. กรอกงานล้างรายวัน' },
  { id: 'history', label: '3. ประวัติย้อนหลัง' },
  { id: 'inventory_tech', label: '4. ทะเบียนแอร์และช่าง' },
  { id: 'reports', label: '5. พิมพ์รายงาน A4 / Excel' },
  { id: 'sheets_admin', label: '6. ซิงค์ Sheets และสิทธิ์', adminOnly: true },
];

interface UserGuideViewProps {
  user: UserAccount;
}

export const UserGuideView: React.FC<UserGuideViewProps> = ({ user }) => {
  const { deviceMode } = useDeviceMode();
  const [selectedTab, setSelectedTab] = useState<GuideSectionId>('all');
  const isAdmin = user.role === 'super_admin';

  const sections: GuideSection[] = [
    {
      id: 'login_device',
      title: '1. การเข้าสู่ระบบ และเลือกขนาดหน้าจอให้เหมาะกับเครื่องที่ใช้',
      shortLabel: 'เข้าสู่ระบบ',
      subtitle: 'เลือกประเภทอุปกรณ์ก่อนเข้าใช้งาน ระบบจะปรับเมนู ปุ่มกด และตารางให้อัตโนมัติ',
      icon: <MonitorSmartphone className="w-5 h-5 text-[#4A7C9B]" />,
      steps: [
        {
          num: 1,
          title: 'กรอกชื่อผู้ใช้งาน (Username) และรหัสผ่าน',
          detail: 'ใช้บัญชีที่ Admin สร้างให้ เพื่อให้นับยอดงานล้างและสิทธิ์เข้าถึงเมนูได้ถูกต้องตามตัวบุคคล',
        },
        {
          num: 2,
          title: 'เลือกอุปกรณ์ที่กำลังใช้งาน (คอมพิวเตอร์ / แท็บเล็ต / โทรศัพท์มือถือ)',
          detail:
            'คอมพิวเตอร์: แสดงเมนูด้านซ้ายครบถ้วน · แท็บเล็ต: ปุ่มใหญ่ขึ้นและเมนูพับเก็บได้ · โทรศัพท์มือถือ: มีแถบเมนูลัดด้านล่างและแสดงข้อมูลแบบการ์ดอ่านง่ายไม่ต้องเลื่อนซ้ายขวา',
        },
        {
          num: 3,
          title: 'เปลี่ยนโหมดอุปกรณ์ภายหลังได้ตลอดเวลา',
          detail: 'หลังจากเข้าสู่ระบบแล้ว สามารถกดสลับโหมด คอมฯ / แท็บเล็ต / มือถือ ได้จากแถบด้านบนของหน้าจอทันที',
        },
      ],
      tip: 'ช่างที่ออกหน้างานด้วยโทรศัพท์มือถือ แนะนำให้เลือก "โทรศัพท์มือถือ" เพื่อให้ปุ่มกดสถานะมีขนาดใหญ่และบันทึกงานได้รวดเร็วด้วยมือเดียว',
      illustration: (
        <svg viewBox="0 0 460 250" className="w-full h-auto rounded-lg border border-[#DCE4EE] bg-[#F8FAFC]">
          <rect x="14" y="14" width="432" height="222" rx="12" fill="#FFFFFF" stroke="#CBD5E1" />
          <rect x="14" y="14" width="146" height="222" rx="12" fill="#EEF4F9" />
          <rect x="148" y="14" width="12" height="222" fill="#EEF4F9" />
          <rect x="30" y="34" width="44" height="44" rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
          <text x="52" y="61" textAnchor="middle" fontSize="13" fontWeight="700" fill="#4A7C9B">LOGO</text>
          <text x="30" y="102" fontSize="11" fontWeight="700" fill="#1E293B">บริษัท รุ่งเรืองกิจการช่าง</text>
          <text x="30" y="120" fontSize="9" fill="#64748B">ระบบบริหารงานล้างแอร์</text>
          <line x1="30" y1="142" x2="140" y2="142" stroke="#D6E3EE" />
          <text x="30" y="164" fontSize="9" fill="#475569">หน้าจอบริหารงานรายวัน</text>
          <text x="30" y="180" fontSize="9" fill="#475569">รายงาน &amp; พิมพ์ A4</text>

          <text x="180" y="42" fontSize="13" fontWeight="700" fill="#1E293B">เข้าสู่ระบบปฏิบัติงาน</text>
          <rect x="180" y="54" width="244" height="28" rx="6" fill="#F8FAFC" stroke="#CBD5E1" />
          <text x="190" y="72" fontSize="10" fill="#475569">Username / Password</text>
          <circle cx="432" cy="68" r="10" fill="#4A7C9B" />
          <text x="432" y="72" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">1</text>

          <text x="180" y="102" fontSize="10" fontWeight="600" fill="#334155">เลือกเครื่องที่ใช้งาน</text>
          <rect x="180" y="110" width="76" height="38" rx="7" fill="#EAF2F8" stroke="#4A7C9B" strokeWidth="1.5" />
          <text x="218" y="133" textAnchor="middle" fontSize="10" fontWeight="600" fill="#2F5A78">คอมพิวเตอร์</text>
          <rect x="264" y="110" width="76" height="38" rx="7" fill="#FFFFFF" stroke="#CBD5E1" />
          <text x="302" y="133" textAnchor="middle" fontSize="10" fill="#475569">แท็บเล็ต</text>
          <rect x="348" y="110" width="76" height="38" rx="7" fill="#FFFFFF" stroke="#CBD5E1" />
          <text x="386" y="133" textAnchor="middle" fontSize="10" fill="#475569">มือถือ</text>
          <circle cx="432" cy="129" r="10" fill="#4A7C9B" />
          <text x="432" y="133" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">2</text>

          <rect x="180" y="164" width="244" height="34" rx="7" fill="#4A7C9B" />
          <text x="302" y="185" textAnchor="middle" fontSize="11" fontWeight="600" fill="#FFFFFF">เข้าสู่ระบบ</text>

          <rect x="180" y="206" width="244" height="20" rx="5" fill="#ECF6F1" />
          <text x="190" y="219" fontSize="9" fill="#25593E">สลับโหมดอุปกรณ์ภายหลังได้ที่มุมขวาบน</text>
          <circle cx="432" cy="216" r="10" fill="#2F6A4E" />
          <text x="432" y="220" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">3</text>
        </svg>
      ),
    },
    {
      id: 'daily_entry',
      title: '2. การกรอกงานล้างรายวัน',
      shortLabel: 'กรอกงานล้างรายวัน',
      subtitle: 'ดึงรายชื่อห้องที่ยังไม่ถูกล้างในเดือนนั้น กดเลือกสถานะ และบันทึกเป็นชุดได้ทันที',
      icon: <ClipboardPlus className="w-5 h-5 text-[#4A7C9B]" />,
      steps: [
        {
          num: 1,
          title: 'เลือกวันที่ อาคาร และรายชื่อช่างผู้ปฏิบัติงาน',
          detail: 'ระบบจะกรองรายชื่อเครื่องปรับอากาศเฉพาะอาคารที่เลือก และหากไม่ใช่ Admin ระบบจะแสดงเฉพาะรายชื่อช่างเทคนิค',
        },
        {
          num: 2,
          title: 'เลือกรายการห้องจากฝั่งซ้าย (ซ่อนห้องที่บันทึกในเดือนนี้แล้วอัตโนมัติ)',
          detail:
            'ห้องที่ถูกบันทึกในเดือนที่เลือกไปแล้วจะถูกซ่อนไม่ให้แสดงซ้ำ (หากจำเป็นต้องดูห้องที่บันทึกแล้ว สามารถติ๊กช่อง "แสดงเครื่องที่บันทึกเดือนนี้แล้ว" ได้)',
        },
        {
          num: 3,
          title: 'กดเพิ่มเครื่องใหม่ด้วยตนเอง (เฉพาะเมื่อพบเครื่องที่ยังไม่มีในทะเบียน)',
          detail: 'กดปุ่ม "+ เพิ่มเครื่องปรับอากาศใหม่ด้วยตนเอง" เพื่อเปิดแบบฟอร์มกรอกข้อมูลเครื่องใหม่ต่อท้ายอาคารนั้น',
        },
        {
          num: 4,
          title: 'ตรวจสอบคิวฝั่งขวา ใส่หมายเหตุ แล้วกด "บันทึกงานล้าง"',
          detail: 'สามารถกดเปลี่ยนสถานะ (ล้างแล้ว / คนไข้ / ปรับปรุง / ไม่มีการ์ด) และใส่หมายเหตุรายเครื่องก่อนบันทึกได้',
        },
      ],
      tip: 'กรณีเปิด Auto-Sync Google Sheets ไว้ เมื่อกดบันทึกงานล้างแล้ว ระบบจะอัปเดตเฉพาะแถวใหม่ต่อท้ายใน Google Sheets ให้อัตโนมัติ',
      illustration: (
        <svg viewBox="0 0 460 265" className="w-full h-auto rounded-lg border border-[#DCE4EE] bg-[#F8FAFC]">
          <rect x="12" y="12" width="436" height="48" rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
          <rect x="24" y="23" width="122" height="26" rx="5" fill="#F8FAFC" stroke="#CBD5E1" />
          <text x="32" y="40" fontSize="9.5" fill="#334155">วันที่เข้าล้าง</text>
          <rect x="156" y="23" width="132" height="26" rx="5" fill="#F8FAFC" stroke="#CBD5E1" />
          <text x="164" y="40" fontSize="9.5" fill="#334155">อาคารที่เข้าล้าง</text>
          <rect x="298" y="23" width="128" height="26" rx="5" fill="#F8FAFC" stroke="#CBD5E1" />
          <text x="306" y="40" fontSize="9.5" fill="#334155">ช่างผู้ปฏิบัติงาน</text>
          <circle cx="436" cy="24" r="10" fill="#4A7C9B" />
          <text x="436" y="28" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">1</text>

          <rect x="12" y="70" width="248" height="128" rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
          <text x="24" y="88" fontSize="10.5" fontWeight="700" fill="#1E293B">1. เครื่องที่ยังไม่บันทึกเดือนนี้</text>
          <circle cx="246" cy="84" r="10" fill="#4A7C9B" />
          <text x="246" y="88" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">2</text>

          <rect x="24" y="100" width="224" height="36" rx="6" fill="#FAFBFD" stroke="#E2E8F0" />
          <text x="32" y="116" fontSize="9.5" fontWeight="600" fill="#1E293B">A-101 · ห้องตรวจ 1</text>
          <rect x="148" y="108" width="44" height="20" rx="4" fill="#ECF6F1" />
          <text x="170" y="121" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#25593E">ล้างแล้ว</text>
          <rect x="196" y="108" width="44" height="20" rx="4" fill="#FDF6EC" />
          <text x="218" y="121" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#8C5E26">คนไข้</text>

          <rect x="24" y="144" width="224" height="36" rx="6" fill="#FAFBFD" stroke="#E2E8F0" />
          <text x="32" y="160" fontSize="9.5" fontWeight="600" fill="#1E293B">A-102 · ห้องตรวจ 2</text>
          <rect x="148" y="152" width="44" height="20" rx="4" fill="#F3F0FA" />
          <text x="170" y="165" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#5B4B85">ปรับปรุง</text>
          <rect x="196" y="152" width="44" height="20" rx="4" fill="#FDF0F2" />
          <text x="218" y="165" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#9D3E4E">ไม่มีการ์ด</text>

          <rect x="12" y="208" width="248" height="44" rx="8" fill="#FFFFFF" stroke="#CBD5E1" strokeDasharray="4 3" />
          <text x="24" y="234" fontSize="9.5" fontWeight="600" fill="#2F5A78">+ กดเปิดฟอร์มเพิ่มเครื่องใหม่ด้วยตนเอง</text>
          <circle cx="246" cy="230" r="10" fill="#4A7C9B" />
          <text x="246" y="234" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">3</text>

          <rect x="270" y="70" width="178" height="182" rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
          <text x="282" y="90" fontSize="10.5" fontWeight="700" fill="#1E293B">คิวรอการบันทึก (2)</text>
          <rect x="282" y="102" width="154" height="44" rx="6" fill="#FAFBFD" stroke="#E2E8F0" />
          <text x="290" y="118" fontSize="9" fontWeight="600" fill="#3B6684">1. A-101 · ล้างแล้ว</text>
          <text x="290" y="134" fontSize="8.5" fill="#64748B">หมายเหตุ: ...</text>
          <rect x="282" y="152" width="154" height="44" rx="6" fill="#FAFBFD" stroke="#E2E8F0" />
          <text x="290" y="168" fontSize="9" fontWeight="600" fill="#3B6684">2. A-102 · คนไข้</text>
          <text x="290" y="184" fontSize="8.5" fill="#64748B">หมายเหตุ: นัดล้างใหม่</text>

          <rect x="282" y="208" width="154" height="32" rx="7" fill="#4A7C9B" />
          <text x="359" y="228" textAnchor="middle" fontSize="10" fontWeight="600" fill="#FFFFFF">บันทึกงานล้าง</text>
          <circle cx="436" cy="224" r="10" fill="#2F6A4E" />
          <text x="436" y="228" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">4</text>
        </svg>
      ),
    },
    {
      id: 'history',
      title: '3. ประวัติการล้างย้อนหลัง แก้ไข และลบข้อมูล',
      shortLabel: 'ประวัติย้อนหลัง',
      subtitle: 'ตรวจสอบยอดงานตามช่วงวันที่ ค้นหารายเครื่อง แก้ไขสถานะ หรือส่งออก Excel',
      icon: <History className="w-5 h-5 text-[#4A7C9B]" />,
      steps: [
        {
          num: 1,
          title: 'กรองข้อมูลตามช่วงวันที่ อาคาร สถานะ หรือชื่อช่าง',
          detail: 'สามารถพิมพ์ค้นหาด้วยชื่อห้องหรือหมายเลขเครื่องได้ทันที และดูสรุปยอดรวมด้านบน',
        },
        {
          num: 2,
          title: 'กดไอคอนดินสอ (แก้ไข) หรือถังขยะ (ลบ) ด้านขวาของรายการ',
          detail:
            'สิทธิ์แก้ไขและลบขึ้นอยู่กับที่ Admin กำหนด หากบัญชีถูกตั้งค่า "เพิ่ม ลบ แก้ไขข้อมูลการล้างเดือนปัจจุบันเท่านั้น" จะแก้ไข/ลบได้เฉพาะรายการของเดือนปัจจุบัน ข้อมูลเดือนเก่าจะถูกล็อกอัตโนมัติ',
        },
        {
          num: 3,
          title: 'ดาวน์โหลดไฟล์ Excel สรุปรวมได้ทันที',
          detail: 'กดปุ่ม "ดาวน์โหลด Excel" เพื่อบันทึกข้อมูลตามช่วงวันที่ที่เลือกเก็บไว้ใช้งานต่อ',
        },
      ],
      tip: 'บนโทรศัพท์มือถือ หน้าจอประวัติจะแสดงเป็นการ์ดเรียงลงมาเพื่อให้เห็นทั้งวันที่ ชื่อห้อง สถานะ และปุ่มจัดการครบในหน้าเดียว',
      illustration: (
        <svg viewBox="0 0 460 245" className="w-full h-auto rounded-lg border border-[#DCE4EE] bg-[#F8FAFC]">
          <rect x="12" y="12" width="436" height="58" rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
          <text x="24" y="30" fontSize="10.5" fontWeight="700" fill="#1E293B">ตัวกรองประวัติย้อนหลัง</text>
          <rect x="24" y="38" width="90" height="22" rx="5" fill="#F8FAFC" stroke="#CBD5E1" />
          <text x="32" y="53" fontSize="8.5" fill="#475569">ตั้งแต่วันที่</text>
          <rect x="120" y="38" width="90" height="22" rx="5" fill="#F8FAFC" stroke="#CBD5E1" />
          <text x="128" y="53" fontSize="8.5" fill="#475569">ถึงวันที่</text>
          <rect x="216" y="38" width="110" height="22" rx="5" fill="#F8FAFC" stroke="#CBD5E1" />
          <text x="224" y="53" fontSize="8.5" fill="#475569">อาคาร / ช่าง / ค้นหา</text>
          <circle cx="342" cy="49" r="10" fill="#4A7C9B" />
          <text x="342" y="53" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">1</text>

          <rect x="358" y="24" width="80" height="34" rx="6" fill="#EAF5EF" stroke="#C6E2D2" />
          <text x="398" y="45" textAnchor="middle" fontSize="9" fontWeight="600" fill="#2F6A4E">Excel</text>
          <circle cx="436" cy="24" r="10" fill="#2F6A4E" />
          <text x="436" y="28" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">3</text>

          <rect x="12" y="80" width="436" height="152" rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
          <rect x="12" y="80" width="436" height="28" rx="8" fill="#F4F7FA" />
          <text x="26" y="98" fontSize="9.5" fontWeight="600" fill="#475569">วันที่</text>
          <text x="95" y="98" fontSize="9.5" fontWeight="600" fill="#475569">อาคาร / ห้อง</text>
          <text x="220" y="98" fontSize="9.5" fontWeight="600" fill="#475569">รหัสแอร์</text>
          <text x="295" y="98" fontSize="9.5" fontWeight="600" fill="#475569">สถานะ</text>
          <text x="392" y="98" fontSize="9.5" fontWeight="600" fill="#475569">จัดการ</text>

          <line x1="12" y1="146" x2="448" y2="146" stroke="#EEF2F6" />
          <text x="26" y="128" fontSize="9.5" fill="#1E293B">20 พ.ย. 69</text>
          <text x="95" y="128" fontSize="9.5" fill="#1E293B">อาคาร A · ห้อง 1401</text>
          <text x="220" y="128" fontSize="9.5" fontWeight="600" fill="#3B6684">1401</text>
          <rect x="290" y="116" width="56" height="18" rx="4" fill="#ECF6F1" />
          <text x="318" y="128" textAnchor="middle" fontSize="8.5" fill="#25593E">ล้างแล้ว</text>
          <rect x="378" y="114" width="24" height="22" rx="4" fill="#EAF2F8" />
          <text x="390" y="129" textAnchor="middle" fontSize="9" fill="#2F5A78">แก้</text>
          <rect x="406" y="114" width="24" height="22" rx="4" fill="#FDF0F2" />
          <text x="418" y="129" textAnchor="middle" fontSize="9" fill="#9D3E4E">ลบ</text>
          <circle cx="438" cy="125" r="10" fill="#4A7C9B" />
          <text x="438" y="129" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">2</text>

          <text x="26" y="172" fontSize="9.5" fill="#64748B">15 ต.ค. 69</text>
          <text x="95" y="172" fontSize="9.5" fill="#64748B">อาคาร A · ห้อง 1404</text>
          <text x="220" y="172" fontSize="9.5" fill="#64748B">1404</text>
          <rect x="290" y="160" width="56" height="18" rx="4" fill="#ECF6F1" />
          <text x="318" y="172" textAnchor="middle" fontSize="8.5" fill="#25593E">ล้างแล้ว</text>
          <rect x="376" y="159" width="56" height="20" rx="4" fill="#F1F5F9" />
          <text x="404" y="172" textAnchor="middle" fontSize="8" fill="#64748B">ล็อกเดือนเก่า</text>

          <rect x="24" y="196" width="412" height="24" rx="5" fill="#FFFBEB" stroke="#FDE68A" />
          <text x="34" y="212" fontSize="9" fill="#92400E">หมายเหตุ: รายการเดือนก่อนหน้าจะแก้ไข/ลบไม่ได้ หากถูกจำกัดสิทธิ์เฉพาะเดือนปัจจุบัน</text>
        </svg>
      ),
    },
    {
      id: 'inventory_tech',
      title: '4. ทะเบียนแอร์ทุกอาคาร และรายชื่อช่างเทคนิค',
      shortLabel: 'ทะเบียนแอร์ & ช่าง',
      subtitle: 'จัดการทะเบียนเครื่องปรับอากาศทั้งหมดในสัญญา และดูแลรายชื่อช่างพร้อมเบอร์โทร',
      icon: <Building2 className="w-5 h-5 text-[#4A7C9B]" />,
      steps: [
        {
          num: 1,
          title: 'เพิ่ม/แก้ไขเครื่องปรับอากาศ หรือนำเข้าจาก Excel ทีละหลายร้อยเครื่อง',
          detail:
            'ในหน้า "ทะเบียนแอร์ทุกอาคาร" สามารถเพิ่มเครื่องใหม่ แก้ไขรุ่น/BTU เปลี่ยนสถานะเป็น "ยกเลิก" (ไม่นับยอดในสัญญา) หรือดาวน์โหลดเทมเพลต Excel มาอัปโหลดได้',
        },
        {
          num: 2,
          title: 'ตรวจสอบสรุปจำนวนแอร์แยกตามอาคารและชั้น',
          detail: 'สลับดูแท็บสรุปเพื่อตรวจเช็กจำนวนแอร์ปกติและ VRF/VRV รายชั้นของทุกอาคาร',
        },
        {
          num: 3,
          title: 'จัดการรายชื่อช่างเทคนิคและสิทธิ์การล็อกอิน',
          detail:
            'หัวหน้าช่างและ Admin สามารถเพิ่มรายชื่อช่าง พร้อมเลือกได้ว่าจะให้ช่างคนนั้นมีบัญชีเข้าสู่ระบบด้วยตนเองหรือไม่',
        },
      ],
      tip: 'การเปลี่ยนสถานะแอร์เป็น "ยกเลิก" ในหน้าทะเบียน จะยังคงเก็บประวัติการล้างเก่าไว้ครบถ้วน แต่ไม่นำเครื่องที่ยกเลิกมานับรวมในยอดสัญญาปัจจุบัน',
      illustration: (
        <svg viewBox="0 0 460 225" className="w-full h-auto rounded-lg border border-[#DCE4EE] bg-[#F8FAFC]">
          <rect x="12" y="12" width="436" height="44" rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
          <text x="24" y="38" fontSize="11" fontWeight="700" fill="#1E293B">ทะเบียนเครื่องปรับอากาศทุกอาคาร</text>
          <rect x="248" y="21" width="90" height="26" rx="6" fill="#EAF5EF" stroke="#C6E2D2" />
          <text x="293" y="38" textAnchor="middle" fontSize="9" fontWeight="600" fill="#2F6A4E">นำเข้า Excel</text>
          <rect x="346" y="21" width="88" height="26" rx="6" fill="#4A7C9B" />
          <text x="390" y="38" textAnchor="middle" fontSize="9" fontWeight="600" fill="#FFFFFF">+ เพิ่มเครื่อง</text>
          <circle cx="438" cy="22" r="10" fill="#4A7C9B" />
          <text x="438" y="26" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">1</text>

          <rect x="12" y="68" width="212" height="145" rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
          <text x="24" y="88" fontSize="10" fontWeight="700" fill="#1E293B">สรุปรายอาคาร / ชั้น</text>
          <circle cx="206" cy="84" r="10" fill="#4A7C9B" />
          <text x="206" y="88" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">2</text>
          <rect x="24" y="100" width="188" height="32" rx="6" fill="#F8FAFC" stroke="#E2E8F0" />
          <text x="34" y="120" fontSize="9.5" fill="#334155">อาคาร A · แอร์ปกติ / VRF</text>
          <rect x="24" y="138" width="188" height="32" rx="6" fill="#F8FAFC" stroke="#E2E8F0" />
          <text x="34" y="158" fontSize="9.5" fill="#334155">อาคาร B1 · ชั้น 1-5</text>
          <rect x="24" y="176" width="188" height="26" rx="6" fill="#EEF4F9" />
          <text x="34" y="193" fontSize="9" fontWeight="600" fill="#2F5A78">รวมใช้งานทั้งหมด (ไม่รวมยกเลิก)</text>

          <rect x="236" y="68" width="212" height="145" rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
          <text x="248" y="88" fontSize="10" fontWeight="700" fill="#1E293B">รายชื่อช่างเทคนิค</text>
          <circle cx="430" cy="84" r="10" fill="#4A7C9B" />
          <text x="430" y="88" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">3</text>
          <rect x="248" y="100" width="188" height="44" rx="6" fill="#FAFBFD" stroke="#E2E8F0" />
          <text x="258" y="118" fontSize="9.5" fontWeight="600" fill="#1E293B">ช่างสมชาย · 08x-xxx-xxxx</text>
          <text x="258" y="134" fontSize="8.5" fill="#25593E">เปิดสิทธิ์เข้าสู่ระบบแล้ว</text>
          <rect x="248" y="152" width="188" height="44" rx="6" fill="#FAFBFD" stroke="#E2E8F0" />
          <text x="258" y="170" fontSize="9.5" fontWeight="600" fill="#1E293B">ช่างวิโรจน์ · 08x-xxx-xxxx</text>
          <text x="258" y="186" fontSize="8.5" fill="#64748B">เฉพาะบันทึกยอด (ไม่ล็อกอิน)</text>
        </svg>
      ),
    },
    {
      id: 'reports',
      title: '5. ศูนย์รายงานและพิมพ์เอกสาร A4 (6 รูปแบบ + Excel)',
      shortLabel: 'รายงานและพิมพ์ A4',
      subtitle: 'พรีวิวเอกสารหัวบริษัทครบทั้ง 6 รายงาน พร้อมสั่งพิมพ์ A4 แนวตั้ง/แนวนอน หรือส่งออก Excel',
      icon: <FileText className="w-5 h-5 text-[#4A7C9B]" />,
      steps: [
        {
          num: 1,
          title: 'เลือกประเภทรายงาน 1–6 ที่ต้องการ',
          detail:
            '1) สรุปประจำเดือน/ปี · 2) รายการเข้าล้างแล้วรายเดือน · 3) รายการไม่ได้เข้าล้าง · 4) บัญชีเข้าล้างรายวัน/รายสัปดาห์ (เซ็นตรวจรับ) · 5) สรุปจำนวนแอร์ทุกอาคาร · 6) ผลงานช่างเทคนิค',
        },
        {
          num: 2,
          title: 'ตั้งค่าตัวกรองเฉพาะรายงานนั้น (เช่น รายงาน 4 เลือกรายวันหรือช่วงสัปดาห์)',
          detail:
            'ในรายงานข้อ 4 สามารถสลับเลือก "วันเดียว" หรือ "ช่วงระหว่างวันที่" เพื่อพิมพ์รายสัปดาห์ และเลือกเปิด/ปิดคอลัมน์ "ช่างผู้ล้าง" (แสดงเฉพาะชื่อจริง) ได้',
        },
        {
          num: 3,
          title: 'เลือกแนวกระดาษ A4 แล้วกด "พิมพ์รายงานนี้" หรือ "ดาวน์โหลด Excel"',
          detail: 'ระบบจัดขอบกระดาษ A4 และหัวตารางซ้ำทุกหน้าอัตโนมัติ พร้อมช่องเซ็นชื่อผู้ส่งงานและผู้ตรวจรับงานท้ายเอกสาร',
        },
      ],
      tip: 'ตอนสั่งพิมพ์จากเบราว์เซอร์ ให้ตั้งค่า Margins เป็น Default หรือ None เอกสารจะเว้นขอบกระดาษ A4 ให้ครบ 1 ซม. ทั้ง 4 ด้านอัตโนมัติ',
      illustration: (
        <svg viewBox="0 0 460 250" className="w-full h-auto rounded-lg border border-[#DCE4EE] bg-[#F8FAFC]">
          <rect x="12" y="12" width="436" height="62" rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
          <rect x="22" y="20" width="66" height="22" rx="5" fill="#F1F5F9" />
          <text x="55" y="34" textAnchor="middle" fontSize="8" fill="#475569">1. สรุปเดือน</text>
          <rect x="92" y="20" width="66" height="22" rx="5" fill="#F1F5F9" />
          <text x="125" y="34" textAnchor="middle" fontSize="8" fill="#475569">2. ล้างแล้ว</text>
          <rect x="162" y="20" width="66" height="22" rx="5" fill="#F1F5F9" />
          <text x="195" y="34" textAnchor="middle" fontSize="8" fill="#475569">3. ไม่ได้ล้าง</text>
          <rect x="232" y="20" width="82" height="22" rx="5" fill="#EAF2F8" stroke="#4A7C9B" />
          <text x="273" y="34" textAnchor="middle" fontSize="8" fontWeight="700" fill="#2F5A78">4. เซ็นตรวจรับ</text>
          <circle cx="324" cy="22" r="9" fill="#4A7C9B" />
          <text x="324" y="26" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#FFFFFF">1</text>

          <rect x="340" y="18" width="96" height="26" rx="6" fill="#4A7C9B" />
          <text x="388" y="35" textAnchor="middle" fontSize="9" fontWeight="600" fill="#FFFFFF">พิมพ์ A4 / Excel</text>
          <circle cx="438" cy="20" r="9" fill="#2F6A4E" />
          <text x="438" y="24" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#FFFFFF">3</text>

          <text x="24" y="61" fontSize="8.5" fill="#475569">ตัวกรอง: วันเดียว / ช่วงระหว่างวันที่ (รายสัปดาห์) · อาคาร · สถานะ · แสดง/ซ่อนชื่อช่าง</text>
          <circle cx="436" cy="58" r="9" fill="#4A7C9B" />
          <text x="436" y="62" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#FFFFFF">2</text>

          <rect x="52" y="84" width="356" height="154" rx="6" fill="#FFFFFF" stroke="#CBD5E1" />
          <rect x="68" y="96" width="32" height="26" rx="4" fill="#EEF4F9" />
          <text x="84" y="113" textAnchor="middle" fontSize="8" fontWeight="700" fill="#4A7C9B">LOGO</text>
          <text x="110" y="106" fontSize="9.5" fontWeight="700" fill="#1E293B">บริษัท รุ่งเรืองกิจการช่าง จำกัด</text>
          <text x="392" y="106" textAnchor="end" fontSize="9" fontWeight="700" fill="#1E293B">บัญชีรายการเข้าล้าง (A4)</text>
          <line x1="68" y1="128" x2="392" y2="128" stroke="#334155" strokeWidth="1.5" />
          <rect x="68" y="136" width="324" height="18" fill="#EEF4F9" />
          <text x="76" y="148" fontSize="8" fontWeight="600" fill="#1E293B">ลำดับ | วันที่ | อาคาร | ชั้น | ห้อง | รหัส | สถานะ | ช่างผู้ล้าง | หมายเหตุ</text>
          <rect x="68" y="154" width="324" height="44" fill="#FFFFFF" stroke="#E2E8F0" />
          <text x="230" y="180" textAnchor="middle" fontSize="8.5" fill="#64748B">ตารางข้อมูลเรียงตามวันที่และอาคาร</text>
          <text x="145" y="220" textAnchor="middle" fontSize="8.5" fill="#475569">ลงชื่อ ............................ ผู้ส่งงาน</text>
          <text x="315" y="220" textAnchor="middle" fontSize="8.5" fill="#475569">ลงชื่อ ............................ ผู้ตรวจรับงาน</text>
        </svg>
      ),
    },
    {
      id: 'sheets_admin',
      title: '6. ซิงค์ Google Sheets และตั้งค่าบริษัท / สิทธิ์ผู้ใช้งาน',
      shortLabel: 'ซิงค์ Sheets & สิทธิ์',
      subtitle: 'ส่งข้อมูลขึ้น Google Sheets อัตโนมัติ เปลี่ยนโลโก้บริษัท และกำหนดสิทธิ์ผู้ใช้งานรายคน',
      icon: <Sheet className="w-5 h-5 text-[#4A7C9B]" />,
      steps: [
        {
          num: 1,
          title: 'เชื่อมต่อ Google Sheets (Sign in with Google หรือ Apps Script Web App)',
          detail:
            'สามารถวาง URL ของ Google Apps Script Web App เพื่อให้ซิงค์ได้ทันทีโดยไม่ต้องล็อกอิน Google ซ้ำ และเปิด Auto-Sync เพื่อให้ระบบอัปเดตเฉพาะแถวที่เปลี่ยน',
        },
        {
          num: 2,
          title: 'อัปโหลดโลโก้บริษัทและข้อความหัวกระดาษ',
          detail: 'ในเมนู "ตั้งค่าบริษัทและสิทธิ์ผู้ใช้" สามารถอัปโหลดโลโก้ ชื่อบริษัท ที่อยู่ และชื่อหน้างานโครงการได้',
        },
        {
          num: 3,
          title: 'กำหนดสิทธิ์การใช้งานรายบุคคล (เช่น เฉพาะเดือนปัจจุบันเท่านั้น)',
          detail:
            'Admin สูงสุดสามารถเพิ่ม/แก้ไขผู้ใช้ กำหนดสิทธิ์เข้าดูรายงาน แก้ไข/ลบข้อมูลเก่า หรือติ๊กจำกัด "สามารถเพิ่ม ลบ แก้ไขข้อมูลการล้างเดือนปัจจุบันเท่านั้น" ได้',
        },
      ],
      tip: 'ข้อมูลทั้งหมดถูกเก็บในฐานข้อมูลอย่างปลอดภัย การอัปเดตเวอร์ชันระบบใหม่จะไม่ลบโลโก้บริษัทหรือข้อมูลเก่าที่บันทึกไว้แล้ว',
      illustration: (
        <svg viewBox="0 0 460 225" className="w-full h-auto rounded-lg border border-[#DCE4EE] bg-[#F8FAFC]">
          <rect x="12" y="12" width="212" height="200" rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
          <text x="24" y="34" fontSize="10.5" fontWeight="700" fill="#1E293B">ซิงค์ Google Sheets</text>
          <circle cx="206" cy="30" r="10" fill="#4A7C9B" />
          <text x="206" y="34" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">1</text>
          <rect x="24" y="48" width="188" height="32" rx="6" fill="#F8FAFC" stroke="#CBD5E1" />
          <text x="34" y="68" fontSize="9" fill="#334155">Apps Script URL / Google Sign-in</text>
          <rect x="24" y="90" width="188" height="32" rx="6" fill="#ECF6F1" stroke="#C6E2D2" />
          <text x="34" y="110" fontSize="9" fontWeight="600" fill="#25593E">เปิดซิงค์อัตโนมัติ (Auto-Sync)</text>
          <rect x="24" y="134" width="188" height="62" rx="6" fill="#EEF4F9" />
          <text x="34" y="152" fontSize="8.5" fill="#2F5A78">• แก้ไขแถวเดิมเฉพาะจุดที่เปลี่ยน</text>
          <text x="34" y="168" fontSize="8.5" fill="#2F5A78">• เพิ่มข้อมูลใหม่ต่อท้ายตามอาคาร</text>
          <text x="34" y="184" fontSize="8.5" fill="#2F5A78">• ครบ 6 แท็บรายงานมาตรฐาน</text>

          <rect x="236" y="12" width="212" height="94" rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
          <text x="248" y="34" fontSize="10.5" fontWeight="700" fill="#1E293B">ข้อมูลบริษัท &amp; โลโก้</text>
          <circle cx="430" cy="30" r="10" fill="#4A7C9B" />
          <text x="430" y="34" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">2</text>
          <rect x="248" y="48" width="42" height="42" rx="6" fill="#EEF4F9" stroke="#CBD5E1" />
          <text x="269" y="73" textAnchor="middle" fontSize="9" fontWeight="700" fill="#4A7C9B">LOGO</text>
          <text x="300" y="64" fontSize="9" fill="#334155">เปลี่ยนโลโก้และข้อมูล</text>
          <text x="300" y="80" fontSize="9" fill="#64748B">แสดงบนหัวรายงานทุกฉบับ</text>

          <rect x="236" y="116" width="212" height="96" rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
          <text x="248" y="138" fontSize="10.5" fontWeight="700" fill="#1E293B">กำหนดสิทธิ์ผู้ใช้</text>
          <circle cx="430" cy="134" r="10" fill="#4A7C9B" />
          <text x="430" y="138" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFFFFF">3</text>
          <rect x="248" y="150" width="188" height="22" rx="4" fill="#F8FAFC" stroke="#E2E8F0" />
          <text x="256" y="164" fontSize="8.5" fill="#334155">☑ กรอกงาน · ☑ ดูรายงาน</text>
          <rect x="248" y="178" width="188" height="22" rx="4" fill="#FFFBEB" stroke="#FDE68A" />
          <text x="256" y="192" fontSize="8.5" fontWeight="600" fill="#92400E">☑ เพิ่ม/ลบ/แก้ไข เฉพาะเดือนปัจจุบัน</text>
        </svg>
      ),
    },
  ];

  const allowedTabs = GUIDE_TABS.filter((tab) => isAdmin || !tab.adminOnly);
  const allowedSections = sections.filter((s) => isAdmin || s.id !== 'sheets_admin');
  const effectiveTab = !isAdmin && selectedTab === 'sheets_admin' ? 'all' : selectedTab;
  const visibleSections =
    effectiveTab === 'all'
      ? allowedSections
      : allowedSections.filter((s) => s.id === effectiveTab);

  return (
    <div className="space-y-5">
      {/* Header & Section Filter */}
      <div className="bg-white border border-[#DCE4EE] rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#EAF2F8] text-[#4A7C9B] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1E293B]">คู่มือวิธีใช้งานระบบ (รูปภาพและคำอธิบาย)</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              สรุปขั้นตอนการใช้งานทุกเมนูพร้อมภาพตัวอย่างจุดคลิกและคำอธิบายทีละขั้นตอน เลือกหัวข้อที่ต้องการดูด้านล่างได้ทันที
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#E8EEF4]">
          {allowedTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                effectiveTab === tab.id
                  ? 'bg-[#4A7C9B] text-white'
                  : 'bg-[#F4F7FA] text-[#475569] hover:bg-[#EAF2F8] hover:text-[#2F5A78]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Guide Chapters */}
      <div className="space-y-5">
        {visibleSections.map((section) => (
          <section
            key={section.id}
            className="bg-white border border-[#DCE4EE] rounded-xl p-5 space-y-4"
          >
            <div className="flex items-start gap-3 pb-3 border-b border-[#E8EEF4]">
              <div className="w-9 h-9 rounded-lg bg-[#EEF4F9] flex items-center justify-center shrink-0">
                {section.icon}
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1E293B]">{section.title}</h2>
                <p className="text-xs text-[#64748B] mt-0.5">{section.subtitle}</p>
              </div>
            </div>

            <div
              className={`grid gap-5 items-start ${
                deviceMode === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
              }`}
            >
              {/* Annotated Visual Illustration */}
              <div className={deviceMode === 'mobile' ? '' : 'lg:col-span-6'}>
                {section.illustration}
              </div>

              {/* Numbered Explanations */}
              <div className={`${deviceMode === 'mobile' ? '' : 'lg:col-span-6'} space-y-3`}>
                {section.steps.map((step) => (
                  <div
                    key={step.num}
                    className="flex items-start gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"
                  >
                    <span className="w-6 h-6 rounded-full bg-[#4A7C9B] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {step.num}
                    </span>
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-sm font-semibold text-[#1E293B]">{step.title}</div>
                      <p className="text-xs text-[#475569] leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                ))}

                <div className="p-3 rounded-lg bg-[#ECF6F1] border border-[#C6E2D2] text-xs text-[#25593E] leading-relaxed">
                  <strong>เคล็ดลับ:</strong> {section.tip}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
