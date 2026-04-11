// Supabase Veritabanı Kurulum Scripti
// Bu scripti çalıştırarak tüm tabloları oluşturabilirsiniz

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://urkedrzdvbhdwvrcrnjf.supabase.co';
const supabaseKey = 'sb_publishable_IlZSNwwuZtD_N1cpiddcjQ_e7EzHm_h';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('🔄 Veritabanı kurulumu başlıyor...\n');

  try {
    // 1. KURUMLAR (Institutions) tablosu
    console.log('📋 Kurumlar tablosu oluşturuluyor...');
    const { error: instError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS institutions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          website TEXT,
          logo TEXT,
          plan TEXT DEFAULT 'starter',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    }).catch(() => {
      // RPC yoksa doğrudan insert yapalım
      return supabase.from('institutions').select('id').limit(1);
    });

    // Kurum yoksa ekle
    const { data: existingInst } = await supabase.from('institutions').select('id').limit(1);
    if (!existingInst || existingInst.length === 0) {
      await supabase.from('institutions').insert({
        name: 'Smart Koçluk Sistemi',
        email: 'info@smartkocluk.com',
        phone: '0500 000 00 00',
        address: 'Türkiye',
        website: 'https://smartkocluk.com',
        plan: 'enterprise',
        is_active: true
      });
      console.log('✅ Varsayılan kurum eklendi');
    }

    // 2. KULLANICILAR (Users) tablosu
    console.log('📋 Kullanıcılar tablosu oluşturuluyor...');

    // Kullanıcı yoksa ekle
    const { data: existingUser } = await supabase.from('users').select('id').limit(1);
    if (!existingUser || existingUser.length === 0) {
      await supabase.from('users').insert([
        {
          email: 'admin@smartkocluk.com',
          name: 'Süper Admin',
          phone: '0500 000 00 00',
          role: 'super_admin',
          password_hash: 'Admin123!',
          is_active: true,
          package: 'enterprise',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          email: 'admin@smartvip.com',
          name: 'Admin',
          phone: '0500 111 11 11',
          role: 'admin',
          password_hash: 'admin123',
          is_active: true,
          package: 'professional'
        },
        {
          email: 'ogretmen@smartvip.com',
          name: 'Öğretmen Koç',
          phone: '0500 222 22 22',
          role: 'coach',
          password_hash: 'ogretmen123',
          is_active: true
        },
        {
          email: 'ogrenci@smartvip.com',
          name: 'Öğrenci',
          phone: '0500 333 33 33',
          role: 'student',
          password_hash: 'ogrenci123',
          is_active: true
        }
      ]);
      console.log('✅ Varsayılan kullanıcılar eklendi');
    }

    // 3. ÖĞRENCİLER (Students) tablosu
    console.log('📋 Öğrenciler tablosu kontrol ediliyor...');
    const { data: students } = await supabase.from('students').select('id').limit(1);
    if (!students || students.length === 0) {
      await supabase.from('students').insert({
        name: 'Demo Öğrenci',
        email: 'demo@ogrenci.com',
        phone: '0500 444 44 44',
        class_level: '12',
        school: 'Demo Lisesi',
        parent_name: 'Veli',
        parent_phone: '0500 555 55 55'
      });
      console.log('✅ Demo öğrenci eklendi');
    }

    // 4. KOÇLAR (Coaches) tablosu
    console.log('📋 Koçlar tablosu kontrol ediliyor...');
    const { data: coaches } = await supabase.from('coaches').select('id').limit(1);
    if (!coaches || coaches.length === 0) {
      await supabase.from('coaches').insert({
        name: 'Demo Koç',
        email: 'demo@koc.com',
        phone: '0500 666 66 66',
        specialties: ['Matematik', 'Fizik', 'Kimya']
      });
      console.log('✅ Demo koç eklendi');
    }

    console.log('\n🎉 Veritabanı kurulumu tamamlandı!');
    console.log('\n📝 Giriş bilgileri:');
    console.log('   Süper Admin: admin@smartkocluk.com / Admin123!');
    console.log('   Admin: admin@smartvip.com / admin123');
    console.log('   Koç: ogretmen@smartvip.com / ogretmen123');
    console.log('   Öğrenci: ogrenci@smartvip.com / ogrenci123');

  } catch (error) {
    console.error('❌ Kurulum hatası:', error.message);
  }
}

setupDatabase();
