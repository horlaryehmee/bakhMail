<?php

namespace Database\Seeders;

use App\Models\BrandingSetting;
use App\Models\User;
use App\Support\WorkspaceDemoData;
use App\Support\WorkspacePresenter;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $masterAdmin = User::query()->updateOrCreate([
            'email' => 'admin@bakhtech.com',
        ], [
            'name' => 'Bakare Olayemi',
            'password' => Hash::make('BakhtechAdmin123!'),
            'role' => 'master_admin',
            'title' => 'Master Admin',
            'notification_preferences' => WorkspacePresenter::defaultNotificationPreferences(),
            'is_active' => true,
            'demo_data' => false,
        ]);

        BrandingSetting::query()->updateOrCreate([
            'key' => 'branding',
        ], [
            'brand_name' => 'Bakhtech Solutions',
            'logo_url' => '',
            'logo_size' => 1,
        ]);

        WorkspaceDemoData::populate($masterAdmin);
    }
}
