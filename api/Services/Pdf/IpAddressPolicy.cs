using System.Net;
using System.Net.Sockets;

namespace PdfServices.API.Services.Pdf;

/// <summary>Only public internet addresses may be reached when downloading external images (SSRF protection).</summary>
public static class IpAddressPolicy
{
    // Azure platform virtual IP (DNS, health probes, wire server).
    private static readonly IPAddress AzurePlatformAddress = IPAddress.Parse("168.63.129.16");

    public static bool IsPublic(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }

        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            if (address.Equals(AzurePlatformAddress))
            {
                return false;
            }

            byte[] b = address.GetAddressBytes();
            switch (b[0])
            {
                case 0:
                case 10:
                case 127:
                    return false;
                case 100:
                    if (b[1] >= 64 && b[1] <= 127)
                    {
                        return false; // carrier-grade NAT
                    }

                    break;
                case 169:
                    if (b[1] == 254)
                    {
                        return false; // link-local, includes the instance metadata endpoint
                    }

                    break;
                case 172:
                    if (b[1] >= 16 && b[1] <= 31)
                    {
                        return false;
                    }

                    break;
                case 192:
                    if ((b[1] == 0 && (b[2] == 0 || b[2] == 2)) || (b[1] == 88 && b[2] == 99) || b[1] == 168)
                    {
                        return false;
                    }

                    break;
                case 198:
                    if (b[1] == 18 || b[1] == 19 || (b[1] == 51 && b[2] == 100))
                    {
                        return false;
                    }

                    break;
                case 203:
                    if (b[1] == 0 && b[2] == 113)
                    {
                        return false;
                    }

                    break;
            }

            return b[0] < 224; // multicast and reserved ranges
        }

        if (address.AddressFamily == AddressFamily.InterNetworkV6)
        {
            byte[] b = address.GetAddressBytes();
            if ((b[0] & 0xE0) != 0x20)
            {
                return false; // only global unicast 2000::/3
            }

            if (b[0] == 0x20 && b[1] == 0x01 && ((b[2] == 0x0d && b[3] == 0xb8) || (b[2] == 0x00 && b[3] == 0x00)))
            {
                return false; // documentation and Teredo
            }

            return !(b[0] == 0x20 && b[1] == 0x02); // 6to4 may embed private IPv4 addresses
        }

        return false;
    }
}
