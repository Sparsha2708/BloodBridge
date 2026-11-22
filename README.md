# 🩸 BloodBridge
### Connecting Blood Donors. Building Trust. Saving Lives.

BloodBridge is a blood donation coordination platform designed to make the process of finding, communicating with, and coordinating blood donors more reliable and transparent.

Finding a donor is only the first step. Families often struggle with unverified promises, unreliable communication, unexpected transportation expenses, and uncertainty about whether a donor will actually reach the hospital.

BloodBridge aims to address these challenges by providing a trusted coordination layer between donors, patients, their attendants, and hospitals.

> **You find the donor. We make the interaction verifiable.**

---

## 📌 The Problem

During medical emergencies, patients and their families often depend on WhatsApp groups, personal contacts, social media, and third-party donor directories to find blood donors.

However, finding a potential donor does not guarantee a successful donation.

Some common challenges include:

- **Unverified donor commitments:** Families may receive promises from people claiming to arrange multiple donors without being able to verify those commitments.
- **Communication gaps:** Conversations are scattered across different platforms, making coordination difficult.
- **Uncertainty about donor arrival:** Families may not know whether an accepted donor will actually reach the hospital.
- **Transportation difficulties:** Donors may have to travel long distances, and unclear transportation arrangements can create additional stress.
- **Lack of donation history:** There is no consistent way for families to understand whether previous donor interactions resulted in hospital arrivals or completed donations.

BloodBridge focuses on improving what happens *after a potential donor is identified*.

---

## 💡 Our Solution

BloodBridge provides a centralized platform where patients or their attendants can create blood requests, connect with donors, communicate privately, coordinate transportation, and track the progress of a request.

The platform also aims to establish a verifiable interaction history through hospital-confirmed donation outcomes.

It does not replace hospitals or blood banks. Medical eligibility and the final decision to accept a donation remain with qualified medical professionals.

---

## ✨ Key Features

### 1. Donor Registration and Profiles
- Register as a blood donor.
- Provide basic information such as name, blood group, contact details, and approximate location.
- Maintain a donor profile and participation history.
- Display identity verification status without exposing sensitive identity documents.

### 2. Blood Request Management
- Create blood requests with details such as blood group, hospital, urgency, and required donor count.
- Invite donors found through the platform or external sources.
- Track donor responses and request progress.
- Update remaining requirements as donations are confirmed.

### 3. Real-Time Donor–Recipient Chat
- Private communication between donors and recipients or their attendants.
- Real-time message delivery using Supabase Realtime.
- Google authentication through Supabase Auth.
- Persistent message history using Supabase PostgreSQL.
- Request-specific conversations as part of the planned full implementation.

### 4. Transportation Coordination
The platform aims to provide three transportation options:

- **Arrange transport:** Coordinate transportation for the donor.
- **Donor carpool:** Connect nearby donors travelling to the same hospital.
- **Book a cab:** Support cab coordination through external providers or future integrations.

Transportation coordination is kept separate from blood donation. Donors are not paid for donating blood.

### 5. Donation Verification and History
- Track whether an invited donor accepts a request.
- Record hospital arrival.
- Allow hospitals or authorized staff to confirm donation outcomes.
- Distinguish between completed donations, medical deferrals, cancellations, and no-shows.
- Build a more reliable interaction history based on verified events.

A medically deferred donor should not be treated as an unsuccessful or fraudulent donor. Final eligibility is determined by the hospital.

### 6. Donor Appreciation
The platform may introduce sponsor-funded appreciation rewards for verified participation and meaningful contributions.

These rewards are intended as recognition of voluntary participation, not payment for blood.

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js |
| Development environment | Vite |
| Styling | CSS |
| Authentication | Supabase Auth |
| Google Sign-In | Google OAuth 2.0 |
| Real-time communication | Supabase Realtime |
| Database | Supabase PostgreSQL |
| Backend services | Supabase |

---

## 🏗️ System Architecture

```text
                  BLOODBRIDGE
                       |
          +------------+------------+
          |                         |
      React Frontend           User Interface
          |
          +-------------------------+
          |                         |
     Supabase Auth             Chat Interface
          |                         |
      Google OAuth             Send Message
                                    |
                              Supabase Client
                                    |
                         +----------+----------+
                         |                     |
                    PostgreSQL            Realtime
                         |                     |
                  Store Messages       Notify Connected
                         |                 Users
                         +----------+----------+
                                    |
                              Chat Updates
```

### How Real-Time Chat Works

1. A user signs in using Google.
2. The React application obtains the authenticated Supabase session.
3. The user sends a message through the chat interface.
4. The message is inserted into the PostgreSQL `messages` table.
5. Supabase Realtime detects the database insertion.
6. Other authorized users subscribed to the conversation receive the new message.
7. Previous messages can be retrieved from PostgreSQL when the chat is opened.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js
- npm
- Git
- A Supabase account
- A Google Cloud account for Google OAuth configuration

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

```bash
cd chat_feature
```

Replace the repository URL with your actual GitHub repository URL.

### 2. Install Dependencies

```bash
npm install
```

Install the Supabase JavaScript client:

```bash
npm install @supabase/supabase-js
```

### 3. Configure Supabase

Create a project at [Supabase](https://supabase.com/).

Go to **Project Settings → API** and obtain:

- Project URL
- Publishable key

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

Do not commit `.env` or expose private credentials in your repository.

### 4. Configure Google Authentication

In your Supabase dashboard:

1. Open Authentication.
2. Navigate to Sign In / Providers.
3. Select Google.
4. Enable Google authentication.
5. Add your Google OAuth Client ID and Client Secret.
6. Save the configuration.

Create a Google OAuth Web Client in [Google Cloud Console](https://console.cloud.google.com/).

Add your Supabase callback URL under Google's **Authorized redirect URIs**.

Add your local development URL under **Authorized JavaScript origins**.

In Supabase Authentication → URL Configuration, add your local application URL to the allowed redirect URLs.

For local Vite development, this is usually:

```text
http://localhost:5173
```

### 5. Run the Application

```bash
npm run dev
```

Open the local URL displayed in your terminal.

---

## 🗄️ Database Structure

The current chat prototype uses a PostgreSQL table to store messages.

### Messages Table

| Column | Type | Description |
|---|---|---|
| id | UUID | Unique message identifier |
| room | TEXT | Chat room identifier |
| user_id | UUID | Authenticated sender's ID |
| user_name | TEXT | Sender's display name |
| avatar | TEXT | Sender's profile image |
| message | TEXT | Message content |
| created_at | TIMESTAMPTZ | Message creation time |

### Initial Database Setup

Run the following SQL in the Supabase SQL Editor:

```sql
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room TEXT NOT NULL DEFAULT 'room_one',
    user_id UUID NOT NULL REFERENCES auth.users(id),
    user_name TEXT,
    avatar TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read messages"
ON public.messages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can send their own messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

Enable the `messages` table in the `supabase_realtime` publication to receive database change events.

**Security note:** These initial policies are for development and testing only. Before production, implement request-specific authorization so users can only access conversations associated with their blood requests.

---

## 🔐 Privacy and Security

BloodBridge is designed around the principle that sensitive patient and donor information should only be accessible to authorized users.

Planned security measures include:

- Authenticated access to platform features.
- Role-based access for donors, recipients, and hospital staff.
- Request-specific chat authorization.
- Row Level Security (RLS) policies.
- Protection of sensitive identity information.
- Approximate rather than publicly exposed home locations.
- Controlled access to donation and request history.

---

## 📍 Current Development Status

| Component | Status |
|---|---|
| React + Vite frontend | Implemented |
| BloodBridge chat interface | Implemented |
| Google OAuth integration | Configuration in progress |
| Supabase client setup | In progress |
| Real-time message delivery | Prototype implementation |
| PostgreSQL message storage | Prototype implementation |
| Request-specific conversations | Planned |
| Donor registration and profiles | Planned |
| Blood request management | Planned |
| Hospital-side donation confirmation | Planned |
| Transport coordination | Planned |
| Donor appreciation system | Future scope |

---

## 🔮 Future Scope

BloodBridge aims to evolve into a complete blood donation coordination ecosystem.

Potential future developments include:

- Integration with hospitals and blood banks for verified donation outcomes.
- Individual donor reliability and participation histories based on verified interactions.
- Intelligent donor matching based on blood group, location, availability, and hospital requirements.
- Carpool matching for donors travelling to the same hospital.
- Integration with external cab-booking services.
- Sponsor-funded appreciation and recognition programmes.
- Analytics to understand donor participation and improve coordination.

---

## 🎯 Project Objective

The primary objective of BloodBridge is to make blood donor coordination more transparent, reliable, and organized by connecting donor discovery with structured communication, transportation coordination, and hospital-confirmed donation outcomes.

**BloodBridge is not just about finding a donor. It is about making sure the entire coordination process is more trustworthy.**

---

## 👥 Team

Developed as an academic engineering project by a team of Computer Science and Engineering students.

---

## ❤️ Acknowledgement

Blood donation is an act of voluntary service. BloodBridge aims to support the people involved in this process by reducing coordination difficulties and making donor–recipient interactions more transparent.

**Every donor matters. Every verified effort counts.**
