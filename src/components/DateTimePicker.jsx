import { useEffect, useRef, useState } from 'react'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const MONTH_LABELS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
]

function pad(n) {
  return String(n).padStart(2, '0')
}

// value/onChange dùng đúng format "yyyy-MM-ddTHH:mm" giống input
// datetime-local cũ, nên không cần đổi gì ở nơi khác đang dùng form này.
function parseValue(value) {
  if (value) {
    const d = new Date(value)
    if (!isNaN(d)) return d
  }
  return new Date()
}

function toValue(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDisplay(d) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Trả về mảng các ngày để render lưới lịch của 1 tháng, bắt đầu từ Thứ 2,
// bao gồm cả các ngày "đệm" của tháng trước/sau để lấp đầy tuần.
function getCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1)
  // getDay(): 0 = CN ... 6 = T7. Quy về 0 = T2 ... 6 = CN.
  const startOffset = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - startOffset)

  const days = []
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
  }
  return days
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function DateTimePicker({ value, onChange, required }) {
  const [open, setOpen] = useState(false)
  const selected = parseValue(value)
  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected.getMonth())
  const [time, setTime] = useState(`${pad(selected.getHours())}:${pad(selected.getMinutes())}`)
  const containerRef = useRef(null)

  // Đồng bộ lại tháng đang xem + giờ mỗi khi popup được mở hoặc value đổi từ ngoài.
  useEffect(() => {
    const d = parseValue(value)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
    setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
  }, [value, open])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function commitDate(day) {
    const [h, m] = time.split(':').map(Number)
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0)
    onChange(toValue(next))
  }

  function commitTime(newTime) {
    setTime(newTime)
    const [h, m] = newTime.split(':').map(Number)
    const next = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), h || 0, m || 0)
    onChange(toValue(next))
  }

  function goToMonth(delta) {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  function goToToday() {
    const now = new Date()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
  }

  const days = getCalendarGrid(viewYear, viewMonth)
  const today = new Date()

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="input text-left"
        onClick={() => setOpen((o) => !o)}
      >
        {formatDisplay(selected)}
      </button>
      {/* input ẩn để form validation "required" vẫn hoạt động như trước */}
      {required && (
        <input type="text" tabIndex={-1} value={value || ''} onChange={() => {}} required
          className="absolute inset-0 opacity-0 pointer-events-none w-px h-px" />
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-72 bg-white rounded-lg shadow-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <button type="button" className="btn-secondary px-2 py-1" onClick={() => goToMonth(-1)}>‹</button>
            <div className="text-sm font-medium">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </div>
            <button type="button" className="btn-secondary px-2 py-1" onClick={() => goToMonth(1)}>›</button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-1">
            {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const inMonth = d.getMonth() === viewMonth
              const isSelected = isSameDay(d, selected)
              const isToday = isSameDay(d, today)
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => commitDate(d)}
                  className={
                    'text-sm rounded-md py-1.5 ' +
                    (isSelected
                      ? 'bg-brand-600 text-white font-medium'
                      : inMonth
                        ? 'hover:bg-slate-100 text-slate-700'
                        : 'text-slate-300 hover:bg-slate-50') +
                    (isToday && !isSelected ? ' ring-1 ring-brand-400' : '')
                  }
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
            <input
              type="time"
              className="input py-1"
              value={time}
              onChange={(e) => commitTime(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="button" className="btn-secondary px-2 py-1 text-sm" onClick={goToToday}>Hôm nay</button>
              <button type="button" className="btn-primary px-3 py-1 text-sm" onClick={() => setOpen(false)}>Xong</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
