# Arquitectura de Converzia

Este documento describe la arquitectura general del sistema Converzia, una plataforma multi-tenant de calificación de leads para el sector inmobiliario.

## Vista General

Converzia es una aplicación Next.js full-stack que utiliza Supabase como backend (PostgreSQL + Auth + Storage) y varias integraciones externas para gestionar leads, conversaciones y notificaciones.

## Diagrama de Arquitectura General

```mermaid
graph TB
    subgraph "Cliente"
        A[Next.js App<br/>React/TypeScript]
    end
    
    subgraph "API Layer"
        B[Next.js API Routes<br/>Route Handlers]
    end
    
    subgraph "Backend - Supabase"
        C[PostgreSQL Database<br/>Multi-tenant]
        D[Supabase Auth<br/>JWT Authentication]
        E[Supabase Storage<br/>File Storage]
        F[Row Level Security<br/>RLS Policies]
    end
    
    subgraph "Servicios Externos"
        G[OpenAI API<br/>Embeddings & RAG]
        H[Meta/Facebook API<br/>Lead Ads & WhatsApp]
        I[Google Sheets API<br/>CRM Integration]
        J[Stripe API<br/>Billing]
        K[Resend API<br/>Email]
        L[Chatwoot API<br/>Customer Support]
    end
    
    subgraph "Infraestructura"
        M[Vercel<br/>Hosting & Edge Functions]
        N[Redis<br/>Rate Limiting & Caching]
        O[Sentry<br/>Error Tracking]
    end
    
    A -->|HTTPS| B
    B -->|SDK| D
    B -->|SDK| C
    B -->|SDK| E
    C -->|RLS| F
    B -->|HTTP API| G
    B -->|HTTP API| H
    B -->|HTTP API| I
    B -->|HTTP API| J
    B -->|HTTP API| K
    B -->|HTTP API| L
    B -->|Redis Client| N
    B -->|Sentry SDK| O
    B -->|Deploy| M
    
    style A fill:#e1f5ff
    style B fill:#fff4e1
    style C fill:#e8f5e9
    style D fill:#e8f5e9
    style E fill:#e8f5e9
```

## Flujo de Datos: Lead Generation

```mermaid
sequenceDiagram
    participant Meta as Meta/Facebook
    participant Webhook as Webhook Handler
    participant DB as PostgreSQL
    participant Scoring as Scoring Service
    participant Delivery as Delivery Service
    participant CRM as CRM Integration
    
    Meta->>Webhook: Lead ad created
    Webhook->>DB: Store lead_source
    Webhook->>Scoring: Score lead
    Scoring->>DB: Store score & status
    alt High Score
        Webhook->>Delivery: Queue delivery
        Delivery->>CRM: Send to CRM
        Delivery->>DB: Mark as delivered
    else Low Score
        Webhook->>DB: Mark as low_priority
    end
```

## Flujo de Datos: Conversación con Lead

```mermaid
sequenceDiagram
    participant Lead as Lead (WhatsApp)
    participant Meta as Meta API
    participant Conversation as Conversation Service
    participant RAG as RAG Service
    participant OpenAI as OpenAI API
    participant DB as Database
    
    Lead->>Meta: Message
    Meta->>Conversation: Webhook
    Conversation->>DB: Load conversation context
    Conversation->>RAG: Search knowledge base
    RAG->>OpenAI: Generate embeddings
    RAG->>DB: Vector similarity search
    RAG->>Conversation: Return relevant chunks
    Conversation->>OpenAI: Generate response with context
    OpenAI->>Conversation: AI response
    Conversation->>Meta: Send message
    Meta->>Lead: Message delivered
    Conversation->>DB: Store conversation & update lead
```

## Flujo de Datos: Billing & Credits

```mermaid
sequenceDiagram
    participant User as User
    participant API as API Route
    participant Stripe as Stripe API
    participant DB as Database
    participant Email as Resend API
    
    User->>API: Initiate checkout
    API->>DB: Create billing_order
    API->>Stripe: Create checkout session
    Stripe->>User: Payment form
    User->>Stripe: Complete payment
    Stripe->>API: Webhook (payment_intent.succeeded)
    API->>DB: Mark order completed
    API->>DB: Add credits via RPC
    API->>Email: Send confirmation
    API->>User: Redirect to success page
```

## Modelo de Datos Multi-tenant

```mermaid
erDiagram
    tenants ||--o{ tenant_members : has
    tenants ||--o{ offers : has
    tenants ||--o{ leads : has
    tenants ||--o{ credit_ledger : has
    tenants ||--o{ tenant_integrations : has
    
    users ||--o{ tenant_members : is_member
    users ||--o{ user_profiles : has
    
    leads ||--o{ lead_offers : references
    leads ||--o{ lead_sources : originates_from
    
    offers ||--o{ lead_offers : matched_with
    
    tenant_integrations ||--o{ deliveries : triggers
    
    tenants {
        uuid id PK
        string name
        string slug
        jsonb settings
        timestamp created_at
    }
    
    tenant_members {
        uuid id PK
        uuid user_id FK
        uuid tenant_id FK
        string role
        string status
    }
    
    leads {
        uuid id PK
        uuid tenant_id FK
        string phone
        string full_name
        decimal score
        string status
    }
    
    credit_ledger {
        uuid id PK
        uuid tenant_id FK
        string transaction_type
        integer amount
        integer balance_after
    }
```

## Seguridad y Aislamiento de Datos

### Row Level Security (RLS)

Todas las tablas principales tienen políticas RLS para garantizar el aislamiento multi-tenant:

1. **Política base**: Usuarios solo pueden acceder a datos de sus tenants activos
2. **Política admin**: Admins de Converzia pueden acceder a todos los datos
3. **Política por rol**: Algunas operaciones requieren roles específicos (OWNER, ADMIN)

```mermaid
graph LR
    A[User Request] --> B{Check Auth}
    B -->|Authenticated| C[Check Tenant Membership]
    C -->|Active Member| D[RLS Policy]
    D -->|Allow| E[Query Data]
    D -->|Deny| F[403 Forbidden]
    B -->|Not Auth| G[401 Unauthorized]
    C -->|Not Member| F
```

### Capas de Seguridad

1. **Nivel 1 - Autenticación**: Supabase Auth con JWT
2. **Nivel 2 - Autorización**: Tenant membership validation
3. **Nivel 3 - RLS**: Database-level row filtering
4. **Nivel 4 - API Validation**: Zod schemas + rate limiting

## Componentes Principales

### Frontend (Next.js App Router)

- **Pages**: Server Components para renderizado inicial
- **Components**: Client Components para interactividad
- **Hooks**: React Query para data fetching y caching
- **Utils**: Helpers compartidos (normalizePhone, logger, etc.)

### Backend (API Routes)

- **Handlers**: Route handlers para endpoints REST
- **Services**: Lógica de negocio (scoring, delivery, conversation)
- **Supabase Client**: Cliente configurado con RLS
- **Error Handling**: Centralizado con `handleApiError`

### Database (PostgreSQL)

- **Tables**: Tablas principales con RLS
- **Functions**: RPC functions para lógica compleja
- **Views**: Materialized views para performance
- **Migrations**: Versionado de schema

## Integraciones

### Meta/Facebook

- **Lead Ads**: Webhook para recibir leads
- **Marketing API**: Gestionar anuncios y métricas
- **WhatsApp Business API**: Enviar mensajes a leads

### OpenAI

- **Embeddings**: Vector embeddings para RAG
- **Chat Completions**: Generación de respuestas conversacionales

### Google Sheets

- **CRM Integration**: Exportar leads a Google Sheets

### Stripe

- **Checkout**: Sesiones de pago para créditos
- **Webhooks**: Confirmación de pagos

## Performance y Optimización

### Estrategias Implementadas

1. **Materialized Views**: `tenant_stats_mv` para dashboards rápidos
2. **Query Timeouts**: Todas las queries tienen timeouts configurados
3. **Indexes**: Índices en columnas frecuentemente consultadas
4. **Connection Pooling**: Supabase maneja pooling automáticamente

### Caching

- **React Query**: Cache de queries en frontend
- **Redis**: Rate limiting y cache temporal (opcional)

## Monitoreo y Observabilidad

### Logging

- **Structured Logging**: Logger centralizado con niveles (debug, info, warn, error)
- **PII Masking**: Automático en logs
- **Context**: Tenant ID, User ID, Request ID en todos los logs

### Error Tracking

- **Sentry**: Captura de errores con contexto completo
- **Error Boundaries**: React Error Boundaries en todas las páginas
- **API Error Handler**: Manejo centralizado de errores

### Audit Logging

- **Audit Table**: `audit_logs` para compliance
- **Critical Actions**: Logging de acciones importantes (tenant creation, credit purchases, GDPR deletions)

## Deployment

### Vercel

- **Edge Functions**: API routes ejecutadas en edge
- **Static Assets**: Archivos estáticos en CDN
- **Environment Variables**: Configuración por ambiente

### Cron Jobs

- **Vercel Cron**: Tareas programadas (refresh materialized views, credit alerts)
- **Daily Tasks**: Procesamiento batch

## Escalabilidad

### Horizontal Scaling

- **Stateless API**: Todas las API routes son stateless
- **Database Connection Pooling**: Manejado por Supabase
- **CDN**: Assets estáticos servidos desde CDN

### Vertical Scaling

- **Database**: Supabase maneja escalado automático
- **Compute**: Vercel escala automáticamente según demanda

## Próximas Mejoras

- [ ] Implementar caching más agresivo con Redis
- [ ] Añadir WebSockets para notificaciones en tiempo real
- [ ] Migrar a Server Actions de Next.js donde sea apropiado
- [ ] Implementar CDN para assets de storage
- [ ] Añadir GraphQL API layer opcional
