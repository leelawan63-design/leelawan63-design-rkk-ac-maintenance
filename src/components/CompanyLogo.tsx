import React from 'react';
import { Wind } from 'lucide-react';

interface CompanyLogoProps {
  logoDataUrl?: string;
  companyName?: string;
  size?: 'sm' | 'md' | 'lg' | 'print';
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  logoDataUrl,
  companyName = 'บริษัท รุ่งเรืองกิจการช่าง จำกัด',
  size = 'md',
}) => {
  const sizeClass =
    size === 'sm'
      ? 'w-9 h-9 rounded-lg'
      : size === 'lg'
        ? 'w-16 h-16 rounded-xl'
        : size === 'print'
          ? 'w-14 h-14 rounded-lg'
          : 'w-11 h-11 rounded-lg';

  if (logoDataUrl) {
    return (
      <div
        className={`${sizeClass} bg-white border border-[#DCE5EE] flex items-center justify-center overflow-hidden shrink-0`}
      >
        <img
          src={logoDataUrl}
          alt={companyName}
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain p-1"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} bg-[#EAF2F8] border border-[#CFE0EE] text-[#3B6D8F] flex items-center justify-center shrink-0`}
      aria-label={companyName}
    >
      <Wind className={size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'} />
    </div>
  );
};
