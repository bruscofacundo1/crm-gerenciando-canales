/* Data, helpers, atoms. Exports to window for cross-script use. */

// ---------- helpers ----------
const cx = (...xs) => xs.filter(Boolean).join(' ');
const fmtMoney = (n, cur, dec) => n == null ? '—' : (cur === 'ARS' ? 'AR$ ' : 'U$S ') + n.toLocaleString('es-AR', dec != null ? { minimumFractionDigits: dec, maximumFractionDigits: dec } : undefined);
const fmtDate  = (d) => {
  const o = typeof d === 'string' ? new Date(d) : d;
  return o.toLocaleDateString('es-AR', { day:'2-digit', month:'short' }).replace('.','');
};
const fmtDateTime = (d) => {
  const o = typeof d === 'string' ? new Date(d) : d;
  return o.toLocaleString('es-AR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
};
const initialsOf = (name='') => name.split(' ').map(s=>s[0]).filter(Boolean).slice(0,2).join('').toUpperCase();

// ---------- Lucide icon wrapper ----------
function Icon({ name, size = 16, className = '', strokeWidth = 2 }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current || !window.lucide) return;
    ref.current.innerHTML = '';
    const svg = window.lucide.createElement(window.lucide.icons[toPascal(name)] || window.lucide.icons.Circle);
    svg.setAttribute('width',  size);
    svg.setAttribute('height', size);
    svg.setAttribute('stroke-width', strokeWidth);
    ref.current.appendChild(svg);
  }, [name, size, strokeWidth]);
  return <span ref={ref} className={cx('inline-flex shrink-0', className)} aria-hidden="true" />;
}
function toPascal(k) {
  return k.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('');
}

// ---------- Logo ----------
function Logo({ size=28, tone='light' }) {
  // En fondo claro (login) envolvemos la imagen en un contenedor oscuro
  if (tone === 'dark') {
    return (
      <div style={{
        width: size, height: size,
        background: '#1B2A4A',
        borderRadius: Math.round(size * 0.22),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <img src="/Logo.png" alt="MySelec" style={{ width: size * 0.85, height: size * 0.85, objectFit: 'contain' }}/>
      </div>
    );
  }
  return (
    <img src="/Logo.png" alt="MySelec"
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

// ---------- Avatar ----------
function Avatar({ name, size=24, tone, src }) {
  const palette = ['#1B2A4A','#2D4A6F','#3B82F6','#0EA5E9','#8B5CF6','#10B981','#F59E0B'];
  const idx = (name || '?').split('').reduce((a,c)=>a+c.charCodeAt(0),0) % palette.length;
  const bg = tone || palette[idx];
  if (src) {
    return (
      <img src={src} alt={name} title={name}
        className="rounded-full object-cover shrink-0"
        style={{ width:size, height:size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white font-semibold leading-none shrink-0"
      style={{ width:size, height:size, background:bg, fontSize: Math.max(10, size*0.42) }}
      title={name}
    >
      {initialsOf(name)}
    </span>
  );
}

// ---------- Badge / Chip ----------
function Badge({ tone='gray', children, dot=false }) {
  const tones = {
    gray:   'bg-ink-300/40 text-ink-700',
    blue:   'bg-brandSoft text-navy-900',
    navy:   'bg-navy-900 text-white',
    green:  'bg-emerald-100 text-emerald-800',
    amber:  'bg-amber-100 text-amber-800',
    red:    'bg-red-100 text-red-700',
    purple: 'bg-violet-100 text-violet-800',
    sky:    'bg-sky-100 text-sky-800',
    orange: 'bg-orange-100 text-orange-800',
    slate:  'bg-slate-200 text-slate-700',
  };
  const dotColor = {
    gray:'#94A3B8', blue:'#3B82F6', navy:'#1B2A4A', green:'#10B981',
    amber:'#F59E0B', red:'#EF4444', purple:'#8B5CF6', sky:'#0EA5E9', orange:'#F97316', slate:'#64748B'
  }[tone];
  return (
    <span className={cx('chip', tones[tone])}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{background:dotColor}}/>}
      {children}
    </span>
  );
}

// ---------- Domain data ----------
// Datos iniciales vacíos — se reemplazan con los datos reales de la API al iniciar sesión
const USERS   = [];
const CLIENTS = [];

// ---------- Cotizaciones ----------
const STAGES_F1 = [
  { id:'recibida',    label:'Solicitud Recibida',  tone:'gray'   },
  { id:'asignada',    label:'Asignada',            tone:'blue'   },
  { id:'armado',      label:'En Armado',           tone:'navy'   },
  { id:'proveedor',   label:'Esperando Proveedor', tone:'amber'  },
  { id:'oferta',      label:'Oferta Técnica',      tone:'sky'    },
  { id:'enviado',     label:'Presupuesto Enviado', tone:'orange' },
  { id:'aceptada',    label:'Aceptada',            tone:'green'  },
  { id:'rechazada',   label:'Rechazada',           tone:'red'    },
];

const STAGES_F2 = [
  { id:'oc',          label:'OC Recibida',         tone:'gray'   },
  { id:'np',          label:'NP en Flexxus',       tone:'blue'   },
  { id:'stock',       label:'Verificando Stock',   tone:'amber'  },
  { id:'proveedor',   label:'Esperando Proveedor', tone:'orange' },
  { id:'armado',      label:'Armado de Pedido',    tone:'navy'   },
  { id:'facturada',   label:'Facturada',           tone:'purple' },
  { id:'transito',    label:'En Tránsito',         tone:'sky'    },
  { id:'entregada',   label:'Entregada',           tone:'green'  },
];

const QUOTES   = [];
const ORDERS   = [];
const ACTIVITY = [];
const COMMENTS = {};

// Chart data — vacío hasta que la API responda
const CH_SELLERS    = [];
const CH_STAGE_DIST = [];
const CH_MONTHLY    = [];

// Expose to other scripts
Object.assign(window, {
  cx, fmtMoney, fmtDate, fmtDateTime, initialsOf,
  Icon, Logo, Avatar, Badge,
  USERS, CLIENTS, QUOTES, ORDERS,
  STAGES_F1, STAGES_F2, ACTIVITY, COMMENTS,
  CH_SELLERS, CH_STAGE_DIST, CH_MONTHLY,
});
