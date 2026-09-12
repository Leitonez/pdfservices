using System;
using System.Globalization;

namespace PdfServices.API.Infrastructure;

/// <summary>Usage is aggregated per day in Brasília time.</summary>
public static class BrazilTime
{
    private static readonly TimeZoneInfo Zone = ResolveZone();

    public static DateTime FromUtc(DateTime utc)
    {
        return TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Zone);
    }

    public static string DateKey(DateTime utc)
    {
        return FromUtc(utc).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    public static DateTime Today()
    {
        return FromUtc(DateTime.UtcNow).Date;
    }

    private static TimeZoneInfo ResolveZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.CreateCustomTimeZone("BRT", TimeSpan.FromHours(-3), "Brasília", "Brasília");
        }
    }
}
