import type { Icon, IconProps } from "@phosphor-icons/react";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  ArrowUp,
  ArrowUUpLeft,
  At,
  Buildings,
  CalendarBlank,
  CaretCircleDown,
  CaretUpDown,
  Check,
  CheckCircle,
  CheckSquare,
  CircleNotch,
  Clock,
  CloudSlash,
  Code,
  Copy,
  CopySimple,
  DotsSixVertical,
  DownloadSimple,
  Eye,
  File,
  FilePlus,
  FileText,
  GearSix,
  GridFour,
  GitBranch,
  HardDrives,
  Hash,
  Key,
  Lightbulb,
  LinkSimple,
  LockSimple,
  MagnifyingGlass,
  Moon,
  PaperPlaneTilt,
  Paperclip,
  Phone,
  Plus,
  Question,
  RadioButton,
  Rows,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  Sparkle,
  Star,
  Sun,
  Table,
  TextAlignLeft,
  TextT,
  Trash,
  Tray,
  UploadSimple,
  User,
  UsersThree,
  VideoCamera,
  Warning,
  WebhooksLogo,
  WifiSlash,
  X,
} from "@phosphor-icons/react/dist/ssr";
import type { FieldType } from "@/features/forms/schema";

/** One icon set for the app: Phosphor, duotone by default. Works in server and client components. */
const d = (I: Icon, weight: IconProps["weight"] = "duotone") => {
  const C = (p: IconProps) => <I weight={weight} aria-hidden {...p} />;
  C.displayName = I.displayName;
  return C;
};

export const ArrowLeftIcon = d(ArrowLeft, "bold");
export const ArrowRightIcon = d(ArrowRight, "bold");
export const ArrowUpIcon = d(ArrowUp, "bold");
export const CheckCircleIcon = d(CheckCircle);
export const CheckIcon = d(Check, "bold");
export const CloudOffIcon = d(CloudSlash);
export const CodeIcon = d(Code);
export const CopyIcon = d(Copy);
export const DuplicateIcon = d(CopySimple);
export const DownloadIcon = d(DownloadSimple);
export const ExternalLinkIcon = d(ArrowSquareOut);
export const EyeIcon = d(Eye);
export const FileIcon = d(File);
export const FilePlusIcon = d(FilePlus);
export const FileTextIcon = d(FileText);
export const LogicIcon = d(GitBranch);
export const GripIcon = d(DotsSixVertical, "bold");
export const InboxIcon = d(Tray);
export const KeyIcon = d(Key);
export const LightbulbIcon = d(Lightbulb);
export const LinkIcon = d(LinkSimple);
export const SpinnerIcon = d(CircleNotch, "bold");
export const LockIcon = d(LockSimple);
export const SignOutIcon = d(SignOut);
export const QuestionIcon = d(Question);
export const MoonIcon = d(Moon);
export const PlusIcon = d(Plus, "bold");
export const RefreshIcon = d(ArrowClockwise, "bold");
export const RetryIcon = d(ArrowCounterClockwise, "bold");
export const SearchIcon = d(MagnifyingGlass);
export const SendIcon = d(PaperPlaneTilt);
export const ServerIcon = d(HardDrives);
export const SheetIcon = d(Table);
export const ShieldIcon = d(ShieldCheck);
export const SparkleIcon = d(Sparkle);
export const StarIcon = d(Star);
export const SunIcon = d(Sun);
export const TrashIcon = d(Trash);
export const WarningIcon = d(Warning);
export const UndoIcon = d(ArrowUUpLeft, "bold");
export const UploadIcon = d(UploadSimple);
export const UsersIcon = d(UsersThree);
export const UserIcon = d(User);
export const OrgIcon = d(Buildings);
export const SwitchIcon = d(CaretUpDown, "bold");
export const SettingsIcon = d(GearSix);
export const WebhookIcon = d(WebhooksLogo);
export const OfflineIcon = d(WifiSlash);
export const XIcon = d(X, "bold");

export const TYPE_ICONS: Record<FieldType, ReturnType<typeof d>> = {
  short: d(TextT),
  paragraph: d(TextAlignLeft),
  email: d(At),
  number: d(Hash),
  phone: d(Phone),
  url: d(LinkSimple),
  date: d(CalendarBlank),
  time: d(Clock),
  choice: d(RadioButton),
  checkboxes: d(CheckSquare),
  dropdown: d(CaretCircleDown),
  scale: d(SlidersHorizontal),
  rating: d(Star),
  file: d(Paperclip),
  choice_grid: d(GridFour),
  checkbox_grid: d(CheckSquare),
  text: d(TextAlignLeft),
  video: d(VideoCamera),
  section: d(Rows),
};
