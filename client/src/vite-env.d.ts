/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '@tabler/icons-react' {
  export const IconTrendingUp: any;
  export const IconTrendingDown: any;
  export const IconChevronDown: any;
  export const IconChevronLeft: any;
  export const IconChevronRight: any;
  export const IconChevronsLeft: any;
  export const IconChevronsRight: any;
  export const IconCircleCheckFilled: any;
  export const IconDotsVertical: any;
  export const IconGripVertical: any;
  export const IconLayoutColumns: any;
  export const IconLoader: any;
  export const IconPlus: any;
  export const IconTrendingDownFilled: any;
  export const IconTrendingUpFilled: any;
  const icons: Record<string, any>;
  export default icons;
}
