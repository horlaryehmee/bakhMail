<?php

namespace Database\Seeders;

use App\Models\User;
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
        User::updateOrCreate(['email' => 'admin@bakhmail.test'], [
            'name' => 'Admin User',
            'password' => Hash::make('password'),
            'role' => User::ROLE_ADMIN,
            'timezone' => 'Africa/Lagos',
            'avatar_color' => '#60a5fa',
        ]);

        User::updateOrCreate(['email' => 'hello@bakhmail.test'], [
            'name' => 'Growth User',
            'password' => Hash::make('password'),
            'role' => User::ROLE_STANDARD,
            'timezone' => 'Africa/Lagos',
            'avatar_color' => '#34d399',
        ]);
    }
}
