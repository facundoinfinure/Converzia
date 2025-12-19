import { createAdminClient } from "@/lib/supabase/server";
import { fetchWithTimeout } from "@/lib/utils/fetch-with-timeout";

// ============================================
// Chatwoot API Service
// ============================================

interface ChatwootConfig {
  baseUrl: string;
  accountId: string;
  apiToken: string;
  inboxId: string;
}

async function getConfig(): Promise<ChatwootConfig> {
  const supabase = createAdminClient();

  const { data: settings } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "chatwoot_base_url",
      "chatwoot_account_id",
      "chatwoot_api_token",
      "chatwoot_inbox_id",
    ]);

  const settingsMap: Record<string, string> = {};
  (settings || []).forEach((s: any) => {
    settingsMap[s.key] = s.value;
  });

  return {
    baseUrl: settingsMap.chatwoot_base_url || process.env.CHATWOOT_BASE_URL || "",
    accountId: settingsMap.chatwoot_account_id || process.env.CHATWOOT_ACCOUNT_ID || "",
    apiToken: settingsMap.chatwoot_api_token || process.env.CHATWOOT_API_TOKEN || "",
    inboxId: settingsMap.chatwoot_inbox_id || process.env.CHATWOOT_INBOX_ID || "",
  };
}

// ============================================
// Find or Create Contact
// ============================================

export interface ChatwootContact {
  id: number;
  phone_number: string;
  name?: string;
  email?: string;
  conversation_id?: number;
}

export async function findOrCreateContact(
  phone: string,
  name?: string
): Promise<ChatwootContact> {
  const config = await getConfig();

  // First, try to find existing contact
  const searchResponse = await fetchWithTimeout(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/contacts/search?q=${encodeURIComponent(phone)}`,
    {
      headers: {
        "Content-Type": "application/json",
        "api_access_token": config.apiToken,
      },
    },
    10000 // 10 second timeout
  );

  if (searchResponse.ok) {
    const searchData = await searchResponse.json();
    if (searchData.payload?.length > 0) {
      const contact = searchData.payload[0];

      // Get or create conversation for this contact
      const conversation = await getOrCreateConversation(contact.id);

      return {
        id: contact.id,
        phone_number: contact.phone_number,
        name: contact.name,
        email: contact.email,
        conversation_id: conversation?.id,
      };
    }
  }

  // Create new contact
  const createResponse = await fetchWithTimeout(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/contacts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_access_token": config.apiToken,
      },
      body: JSON.stringify({
        inbox_id: config.inboxId,
        name: name || phone,
        phone_number: phone,
      }),
    },
    10000 // 10 second timeout
  );

  if (!createResponse.ok) {
    throw new Error(`Failed to create Chatwoot contact: ${await createResponse.text()}`);
  }

  const contactData = await createResponse.json();
  const contact = contactData.payload.contact;

  // Get or create conversation
  const conversation = await getOrCreateConversation(contact.id);

  return {
    id: contact.id,
    phone_number: contact.phone_number,
    name: contact.name,
    conversation_id: conversation?.id,
  };
}

// ============================================
// Get or Create Conversation
// ============================================

async function getOrCreateConversation(contactId: number) {
  const config = await getConfig();

  // Get contact's conversations
  const response = await fetchWithTimeout(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/contacts/${contactId}/conversations`,
    {
      headers: {
        "Content-Type": "application/json",
        "api_access_token": config.apiToken,
      },
    },
    10000
  );

  if (response.ok) {
    const data = await response.json();
    const conversations = data.payload || [];

    // Find open conversation in our inbox
    const openConvo = conversations.find(
      (c: any) =>
        c.inbox_id === parseInt(config.inboxId) && c.status !== "resolved"
    );

    if (openConvo) {
      return openConvo;
    }
  }

  // Create new conversation
  const createResponse = await fetchWithTimeout(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/conversations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_access_token": config.apiToken,
      },
      body: JSON.stringify({
        inbox_id: config.inboxId,
        contact_id: contactId,
      }),
    },
    10000
  );

  if (!createResponse.ok) {
    console.error("Failed to create conversation:", await createResponse.text());
    return null;
  }

  return await createResponse.json();
}

// ============================================
// Send Message
// ============================================

export async function sendMessage(
  conversationIdOrContactId: string | number,
  content: string,
  privateNote: boolean = false
): Promise<void> {
  const config = await getConfig();

  // If we got a contact ID, we need to find their conversation
  let conversationId = conversationIdOrContactId;
  if (typeof conversationIdOrContactId === "number") {
    const conversation = await getOrCreateConversation(conversationIdOrContactId);
    if (conversation) {
      conversationId = conversation.id;
    }
  }

  const response = await fetchWithTimeout(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_access_token": config.apiToken,
      },
      body: JSON.stringify({
        content,
        message_type: privateNote ? "activity" : "outgoing",
        private: privateNote,
      }),
    },
    15000 // 15 seconds for sending messages
  );

  if (!response.ok) {
    throw new Error(`Failed to send message: ${await response.text()}`);
  }
}

// ============================================
// Send Template Message (WhatsApp)
// ============================================

export async function sendTemplateMessage(
  conversationId: string | number,
  templateName: string,
  templateParams: {
    header?: string[];
    body: string[];
  },
  language: string = "es_AR"
): Promise<void> {
  const config = await getConfig();

  // Build template params for Chatwoot/WhatsApp
  const processedParams: Record<string, string> = {};
  
  // Header params (if any)
  if (templateParams.header) {
    templateParams.header.forEach((param, i) => {
      processedParams[`header_${i + 1}`] = param;
    });
  }
  
  // Body params
  templateParams.body.forEach((param, i) => {
    processedParams[String(i + 1)] = param;
  });

  const response = await fetchWithTimeout(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api_access_token": config.apiToken,
      },
      body: JSON.stringify({
        message_type: "template",
        template_params: {
          name: templateName,
          category: "utility",
          language: language,
          processed_params: processedParams,
        },
      }),
    },
    15000 // 15 seconds for template messages
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Template message failed:", errorText);
    throw new Error(`Failed to send template message: ${errorText}`);
  }
  
  console.log(`Template message sent: ${templateName} to conversation ${conversationId}`);
}

// ============================================
// Get Conversation History
// ============================================

export async function getConversationHistory(
  conversationId: string | number
): Promise<Array<{ sender: string; content: string; created_at: string }>> {
  const config = await getConfig();

  const response = await fetchWithTimeout(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/messages`,
    {
      headers: {
        "Content-Type": "application/json",
        "api_access_token": config.apiToken,
      },
    },
    10000 // 10 seconds for getting history
  );

  if (!response.ok) {
    throw new Error(`Failed to get conversation history: ${await response.text()}`);
  }

  const data = await response.json();

  return (data.payload || []).map((msg: any) => ({
    sender: msg.sender?.type === "contact" ? "user" : "assistant",
    content: msg.content,
    created_at: msg.created_at,
  }));
}

// ============================================
// Update Contact
// ============================================

export async function updateContact(
  contactId: number,
  data: { name?: string; email?: string; custom_attributes?: Record<string, any> }
): Promise<void> {
  const config = await getConfig();

  const response = await fetchWithTimeout(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/contacts/${contactId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "api_access_token": config.apiToken,
      },
      body: JSON.stringify(data),
    },
    10000 // 10 seconds for updating contact
  );

  if (!response.ok) {
    throw new Error(`Failed to update contact: ${await response.text()}`);
  }
}

