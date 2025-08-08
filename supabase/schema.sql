-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'direction', 'communication', 'finance', 'expert', 'member');
CREATE TYPE action_type AS ENUM ('tractage', 'porte_a_porte', 'reunion', 'stand', 'autre');
CREATE TYPE engagement_level AS ENUM ('sympathisant', 'militant', 'donateur', 'benevole_actif');

-- Groups table
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Members table (party members)
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    photo_url TEXT,
    role user_role DEFAULT 'member',
    expertise TEXT,
    availability TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Member groups junction table
CREATE TABLE member_groups (
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (member_id, group_id)
);

-- Contacts (CRM)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    postal_code VARCHAR(10),
    arrondissement INTEGER,
    engagement_level engagement_level DEFAULT 'sympathisant',
    notes TEXT,
    tags TEXT[],
    created_by UUID REFERENCES members(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Donations
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    date DATE NOT NULL,
    payment_method VARCHAR(50),
    receipt_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Polling stations (bureaux de vote)
CREATE TABLE polling_stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255),
    address TEXT,
    arrondissement INTEGER NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    geojson JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Field actions
CREATE TABLE field_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    type action_type NOT NULL,
    date DATE NOT NULL,
    time TIME,
    duration_minutes INTEGER,
    polling_station_id UUID REFERENCES polling_stations(id),
    address TEXT,
    description TEXT,
    estimated_contacts INTEGER,
    materials_used TEXT,
    created_by UUID REFERENCES members(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Action participants
CREATE TABLE action_participants (
    action_id UUID REFERENCES field_actions(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    is_organizer BOOLEAN DEFAULT false,
    PRIMARY KEY (action_id, member_id)
);

-- Communications (internal messaging)
CREATE TABLE communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255),
    message TEXT NOT NULL,
    whatsapp_groups TEXT[],
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    sent_by UUID REFERENCES members(id),
    recipient_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Media monitoring
CREATE TABLE media_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(255) NOT NULL,
    url TEXT,
    title VARCHAR(500),
    content TEXT,
    candidate_mentioned VARCHAR(255),
    sentiment VARCHAR(20),
    keywords TEXT[],
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Newsletter subscriptions
CREATE TABLE newsletter_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(255),
    postal_code VARCHAR(10),
    subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unsubscribed_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Create indexes for better performance
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_role ON members(role);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_engagement ON contacts(engagement_level);
CREATE INDEX idx_contacts_arrondissement ON contacts(arrondissement);
CREATE INDEX idx_field_actions_date ON field_actions(date);
CREATE INDEX idx_field_actions_type ON field_actions(type);
CREATE INDEX idx_polling_stations_arrondissement ON polling_stations(arrondissement);
CREATE INDEX idx_media_monitoring_published ON media_monitoring(published_at);
CREATE INDEX idx_media_monitoring_candidate ON media_monitoring(candidate_mentioned);

-- Row Level Security (RLS)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_monitoring ENABLE ROW LEVEL SECURITY;

-- Create policies (to be refined based on specific requirements)
-- Members can view all members
CREATE POLICY "Members can view all members" ON members
    FOR SELECT USING (auth.uid() IN (SELECT user_id FROM members));

-- Members can update their own profile
CREATE POLICY "Members can update own profile" ON members
    FOR UPDATE USING (auth.uid() = user_id);

-- Only admins can insert/delete members
CREATE POLICY "Admins can manage members" ON members
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM members 
            WHERE role IN ('super_admin', 'admin', 'direction')
        )
    );

-- Similar policies for other tables...

-- Functions for updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_field_actions_updated_at BEFORE UPDATE ON field_actions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default groups
INSERT INTO groups (name, description) VALUES
    ('Direction', 'Comité de direction du parti'),
    ('Finance', 'Équipe finance et trésorerie'),
    ('Communication RP', 'Équipe communication et relations presse'),
    ('Comité Logement', 'Experts en politique du logement'),
    ('Comité Transport', 'Experts en mobilité et transports'),
    ('Comité Écologie', 'Experts en transition écologique'),
    ('Comité Éducation', 'Experts en politique éducative'),
    ('Comité Sécurité', 'Experts en sécurité urbaine');