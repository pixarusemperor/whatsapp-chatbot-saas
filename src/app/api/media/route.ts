import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    let tenantId = formData.get('tenantId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      tenantId = 'default-tenant';
    }

    const fileName = file.name;
    const fileType = file.type;
    const sizeBytes = file.size;

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error } = await supabaseAdmin.storage
      .from('media')
      .upload(`${tenantId}/${fileName}`, buffer, {
        contentType: fileType,
        upsert: true,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to upload to storage' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('media')
      .getPublicUrl(`${tenantId}/${fileName}`);

    const url = publicUrlData?.publicUrl || '';

    return NextResponse.json({
      success: true,
      url,
      fileName,
      fileType,
      sizeBytes,
    });
  } catch (error: any) {
    console.error('Error in media upload API (POST):', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let tenantId = searchParams.get('tenantId');
    if (!tenantId) {
      tenantId = 'default-tenant';
    }

    // List files in the bucket under the tenant's directory
    const { data, error } = await supabaseAdmin.storage
      .from('media')
      .list(tenantId, {
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('Supabase list error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to list media' },
        { status: 500 }
      );
    }

    // Construct response with public URLs for each file
    const files = (data || [])
      .filter((file) => file.name !== '.emptyFolderPlaceholder')
      .map((file) => {
        const { data: publicUrlData } = supabaseAdmin.storage
          .from('media')
          .getPublicUrl(`${tenantId}/${file.name}`);

        return {
          name: file.name,
          id: file.id,
          createdAt: file.created_at,
          sizeBytes: file.metadata?.size || 0,
          url: publicUrlData?.publicUrl || '',
        };
      });

    return NextResponse.json({
      success: true,
      files,
    });
  } catch (error: any) {
    console.error('Error in media list API (GET):', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
