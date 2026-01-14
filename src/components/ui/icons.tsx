/**
 * RetailOS Icon System
 * Lucide React icons with consistent styling
 */

import {
  ShoppingBasket,
  Package,
  AlertTriangle,
  BarChart3,
  Users,
  CreditCard,
  Home,
  Receipt,
  Menu,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Plus,
  Minus,
  X,
  Check,
  Search,
  ScanBarcode,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  DollarSign,
  Banknote,
  Smartphone,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Star,
  Bell,
  HelpCircle,
  Loader2,
  CircleDot,
  type LucideProps
} from 'lucide-react'

// Default icon props for consistency
const defaultProps: Partial<LucideProps> = {
  strokeWidth: 1.5,
  className: 'w-5 h-5'
}

// Export configured icons
export const Icons = {
  // Navigation
  home: (props: LucideProps) => <Home {...defaultProps} {...props} />,
  menu: (props: LucideProps) => <Menu {...defaultProps} {...props} />,
  settings: (props: LucideProps) => <Settings {...defaultProps} {...props} />,
  logout: (props: LucideProps) => <LogOut {...defaultProps} {...props} />,
  
  // Main Features
  pdv: (props: LucideProps) => <ShoppingBasket {...defaultProps} {...props} />,
  scan: (props: LucideProps) => <ScanBarcode {...defaultProps} {...props} />,
  stock: (props: LucideProps) => <Package {...defaultProps} {...props} />,
  losses: (props: LucideProps) => <AlertTriangle {...defaultProps} {...props} />,
  reports: (props: LucideProps) => <BarChart3 {...defaultProps} {...props} />,
  team: (props: LucideProps) => <Users {...defaultProps} {...props} />,
  transactions: (props: LucideProps) => <Receipt {...defaultProps} {...props} />,
  
  // Payment
  wallet: (props: LucideProps) => <Wallet {...defaultProps} {...props} />,
  card: (props: LucideProps) => <CreditCard {...defaultProps} {...props} />,
  cash: (props: LucideProps) => <Banknote {...defaultProps} {...props} />,
  pix: (props: LucideProps) => <Smartphone {...defaultProps} {...props} />,
  credit: (props: LucideProps) => <FileText {...defaultProps} {...props} />,
  dollar: (props: LucideProps) => <DollarSign {...defaultProps} {...props} />,
  
  // Trends
  trendUp: (props: LucideProps) => <TrendingUp {...defaultProps} {...props} />,
  trendDown: (props: LucideProps) => <TrendingDown {...defaultProps} {...props} />,
  arrowUp: (props: LucideProps) => <ArrowUpRight {...defaultProps} {...props} />,
  arrowDown: (props: LucideProps) => <ArrowDownRight {...defaultProps} {...props} />,
  
  // Actions
  plus: (props: LucideProps) => <Plus {...defaultProps} {...props} />,
  minus: (props: LucideProps) => <Minus {...defaultProps} {...props} />,
  close: (props: LucideProps) => <X {...defaultProps} {...props} />,
  check: (props: LucideProps) => <Check {...defaultProps} {...props} />,
  search: (props: LucideProps) => <Search {...defaultProps} {...props} />,
  more: (props: LucideProps) => <MoreVertical {...defaultProps} {...props} />,
  
  // Navigation arrows
  chevronRight: (props: LucideProps) => <ChevronRight {...defaultProps} {...props} />,
  chevronLeft: (props: LucideProps) => <ChevronLeft {...defaultProps} {...props} />,
  
  // Time
  clock: (props: LucideProps) => <Clock {...defaultProps} {...props} />,
  calendar: (props: LucideProps) => <Calendar {...defaultProps} {...props} />,
  
  // Status
  star: (props: LucideProps) => <Star {...defaultProps} {...props} />,
  bell: (props: LucideProps) => <Bell {...defaultProps} {...props} />,
  help: (props: LucideProps) => <HelpCircle {...defaultProps} {...props} />,
  loader: (props: LucideProps) => <Loader2 {...defaultProps} {...props} />,
  dot: (props: LucideProps) => <CircleDot {...defaultProps} {...props} />,
}

export type IconName = keyof typeof Icons
