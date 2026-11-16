// A loopback-only TURN relay for testing PeerDrop on the same computer.
package main

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"os"

	"github.com/pion/turn/v4"
)

func main() {
	ip := net.IPv4(127, 0, 0, 1)
	input := bufio.NewScanner(os.Stdin)
	if !input.Scan() || len(input.Text()) < 32 {
		log.Fatal("Missing local relay secret")
	}
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		log.Fatal("Could not bind the local relay")
	}
	server, err := turn.NewServer(turn.ServerConfig{
		Realm:       "peerdrop-local",
		AuthHandler: turn.LongTermTURNRESTAuthHandler(input.Text(), nil),
		ListenerConfigs: []turn.ListenerConfig{{
			Listener: listener,
			RelayAddressGenerator: &turn.RelayAddressGeneratorStatic{
				RelayAddress: ip,
				Address:      ip.String(),
			},
			PermissionHandler: func(_ net.Addr, peer net.IP) bool { return peer.Equal(ip) },
		}},
	})
	if err != nil {
		log.Fatal("Could not start the local relay")
	}
	defer server.Close()
	fmt.Println(listener.Addr().(*net.TCPAddr).Port)
	// The parent's pipe closes when PeerDrop exits, including on a forced shutdown.
	for input.Scan() {
	}
}
