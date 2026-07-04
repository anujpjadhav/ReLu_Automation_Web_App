import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as Blob;
    const configRaw = formData.get('discordConfig') as string;
    const summaryRaw = formData.get('reportSummary') as string;
    
    if (!pdfFile || !configRaw || !summaryRaw) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const discordConfig = JSON.parse(configRaw);
    const reportSummary = JSON.parse(summaryRaw);

    const { botToken, channelId, fullName, email } = discordConfig;

    if (!botToken || !channelId) {
        return NextResponse.json({ error: 'Discord not configured properly' }, { status: 400 });
    }

    // Construct Discord Message
    const discordFormData = new FormData();
    
    // Add PDF File
    discordFormData.append('files[0]', pdfFile, 'Company_Report.pdf');
    
    // Add Message Content
    const messageContent = {
       content: `**New Company Research Report Generated!**`,
       embeds: [
          {
             title: "Applicant Details",
             color: 5793266, // Blurple
             fields: [
                { name: "Name", value: fullName || 'Not provided', inline: true },
                { name: "Email", value: email || 'Not provided', inline: true },
                { name: "Company Researched", value: reportSummary.companyName || 'Unknown', inline: false },
                { name: "Website", value: reportSummary.website || 'N/A', inline: false }
             ],
             footer: { text: "Generated via AI Company Research Assistant" }
          }
       ]
    };
    
    discordFormData.append('payload_json', JSON.stringify(messageContent));

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
           'Authorization': `Bot ${botToken}`,
           // Do NOT set Content-Type header manually when sending FormData in node/browser! 
           // Fetch sets it with the correct boundary automatically.
        },
        body: discordFormData
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error("Discord API Error:", errText);
        return NextResponse.json({ error: 'Failed to post to Discord' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Discord API Route Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
