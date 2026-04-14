import { cn } from '../../lib/utils';
import { NavLink } from 'react-router-dom';

interface ConversationItemProps {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unreadCount?: number;
  avatarColor?: string;
}

export function ConversationItem({
  id,
  name,
  lastMessage,
  time,
  unreadCount = 0,
  avatarColor = 'bg-gray-200'
}: ConversationItemProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <NavLink
      to={`/c/${id}`}
      className={({ isActive }) =>
        cn(
          'flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 border-l-[3px] transition-colors',
          isActive
            ? 'bg-blue-50/30 border-[#128C7E]'
            : 'border-transparent' // Flat UI border
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className="relative shrink-0 mt-0.5">
            <div
              className={cn(
                'w-8 h-8 rounded text-white flex items-center justify-center text-[11px] font-medium',
                avatarColor
              )}
            >
              {initials}
            </div>
            {/* Online Indicator Badge */}
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-[#25D366] ring-[1.5px] ring-white rounded-full" />
          </div>
          
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex justify-between items-baseline mb-0.5">
              <span
                className={cn(
                  'text-[13px] truncate',
                  isActive || unreadCount > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'
                )}
              >
                {name}
              </span>
              <span
                className={cn(
                  'text-[11px] whitespace-nowrap pl-2',
                  unreadCount > 0 ? 'text-[#128C7E] font-semibold' : 'text-gray-500'
                )}
              >
                {time}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span
                className={cn(
                  'text-[12px] truncate leading-tight',
                  unreadCount > 0 ? 'font-medium text-gray-900' : 'text-gray-500'
                )}
              >
                {lastMessage}
              </span>
              {unreadCount > 0 && (
                <div className="w-[18px] h-[18px] shrink-0 rounded-full bg-[#128C7E] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {unreadCount}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </NavLink>
  );
}
