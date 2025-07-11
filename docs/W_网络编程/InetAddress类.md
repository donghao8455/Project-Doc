## `InetAddress`类

`InetAddress`类主要用于操作我们的`IP`地址，其相关的方法有：

- `getLocalHost`：获取本机`InetAddress`对象
- `getByName`：根据指定主机名/域获取`ip`地址对象
- `getHostName`：获取`InetAddress`对象的主机名
- `getHostAddress`：获取`InetAddress`对象的`IP`地址

```java
import java.net.InetAddress;

public static void main(String[] args) throws UnknownHostException {
    // 获取本机的InetAddress对象（包括IP地址和主机名）
    InetAddress localHost = InetAddress.getLocalHost();
    System.out.println(localHost);   // LAPTOP-4SOCJOED/10.20.18.73
    s
    // 根据主机名 获取InetAddress对象
    InetAddress host1 = InetAddress.getByName("LAPTOP-4SOCJOED");
    System.out.println(host1);  // LAPTOP-4SOCJOED/10.20.18.73   返回的是主机名/IP地址
    
    // 根据域名 获取InetAddress对象
    InetAddress host2 = InetAddress.getByName("www.baidu.com");
    System.out.println(host1);  // www.baidu.com/110.242.68.4   返回的是域名/IP地址
    
    // 通过 InetAddress对象 获取对应的主机名/域名
    String hostName = host2.getHostName();
    System.out.println(hostName);   // www.baidu.com
    
    // 通过 InetAddress对象 获取对应的IP地址
    String hostAddress = host2.getHostAddress();
    System.out.println(hostAddress);   // 110.242.68.4
}
```

