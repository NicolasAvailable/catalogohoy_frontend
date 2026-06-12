import {
  Rocket,
  Package,
  LayoutGrid,
  ClipboardList,
  TrendingUp,
  CreditCard,
  Truck,
  MessageCircle,
  Users,
  Gift,
  Palette,
  UserCog,
  Search,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  Info,
  TriangleAlert,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  Rocket,
  Package,
  LayoutGrid,
  ClipboardList,
  TrendingUp,
  CreditCard,
  Truck,
  MessageCircle,
  Users,
  Gift,
  Palette,
  UserCog,
  Search,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  Info,
  TriangleAlert,
  BookOpen,
};

export const Icon = ({
  name,
  className,
  strokeWidth = 2,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
}) => {
  const Cmp = MAP[name] ?? BookOpen;
  return <Cmp className={className} strokeWidth={strokeWidth} />;
};
