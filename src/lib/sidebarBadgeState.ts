export type SidebarBadgeChannel = 'support';

type SeenState = Record<SidebarBadgeChannel, Record<string, string>>;

type MessageLike = {
  senderRole?: string | null;
  createdAt?: string | null;
};

const STORAGE_KEY = 'seller_sidebar_seen_state_v1';

const EMPTY_STATE: SeenState = {
  support: {},
};

const isBrowser = () => typeof window !== 'undefined';

const readState = (): SeenState => {
  if (!isBrowser()) {
    return EMPTY_STATE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY_STATE;
    }

    const parsed = JSON.parse(raw) as Partial<SeenState>;
    return {
      support: parsed?.support && typeof parsed.support === 'object' ? parsed.support : {},
    };
  } catch {
    return EMPTY_STATE;
  }
};

const writeState = (state: SeenState) => {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore localStorage failures
  }
};

export const getLatestCustomerMessageAt = (messages?: MessageLike[] | null) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return '';
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (String(message?.senderRole || '').toUpperCase() === 'CUSTOMER') {
      return String(message?.createdAt || '');
    }
  }

  return '';
};

export const getSeenAt = (channel: SidebarBadgeChannel, conversationId: string) => {
  const state = readState();
  return String(state[channel]?.[conversationId] || '');
};

export const markConversationSeen = (
  channel: SidebarBadgeChannel,
  conversationId: string,
  messages?: MessageLike[] | null,
) => {
  const seenAt = getLatestCustomerMessageAt(messages);
  if (!conversationId || !seenAt) {
    return '';
  }

  const state = readState();
  const nextState: SeenState = {
    ...state,
    [channel]: {
      ...state[channel],
      [conversationId]: seenAt,
    },
  };
  writeState(nextState);
  return seenAt;
};

export const hasPendingCustomerMessage = (
  channel: SidebarBadgeChannel,
  conversationId: string,
  messages?: MessageLike[] | null,
) => {
  const latestCustomerAt = getLatestCustomerMessageAt(messages);
  if (!conversationId || !latestCustomerAt) {
    return false;
  }

  const seenAt = getSeenAt(channel, conversationId);
  if (!seenAt) {
    return true;
  }

  return new Date(latestCustomerAt).getTime() > new Date(seenAt).getTime();
};

export const emitSidebarBadgesUpdated = () => {
  if (!isBrowser()) {
    return;
  }

  window.dispatchEvent(new Event('seller-sidebar-badges-updated'));
};