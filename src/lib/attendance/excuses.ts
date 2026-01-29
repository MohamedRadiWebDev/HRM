import type { Employee, Leave } from '../types';

export const isExcused = (employee: Employee, date: string, leave?: Leave) => {
  if (leave) return { excused: true, reason: `اجازة (${leave.leaveType})` };
  if (employee.hireDate && date < employee.hireDate) return { excused: true, reason: 'قبل التعيين' };
  if (employee.terminationDate && date > employee.terminationDate) return { excused: true, reason: 'بعد انتهاء الخدمة' };
  return { excused: false, reason: '' };
};
